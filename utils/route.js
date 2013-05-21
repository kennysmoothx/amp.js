var mimeTypes,
	amp		= require('../amp'),
	fs		= require('fs'),
	qs		= require('qs'),
	util	= require('util'),
	emitter	= require('events').EventEmitter;

mimeTypes = {
	'.txt': 'text/plain',

	'.htm': 'text/html',
	'.html': 'text/html',

	'.css': 'text/css',

	'.js': 'application/javascript',
	'.json': 'application/json',
	'.jsonp': 'application/json',

	'.au': 'audio/basic',
	'.m4a': 'audio/mp4',
	'.f4a': 'audio/mp4',
	'.f4b': 'audio/mp4',
	'.oga': 'audio/ogg',
	'.ogg': 'audio/ogg',

	'.avi': 'video/x-msvideo',
	'.mp4': 'video/mp4',
	'.m4v': 'video/mp4',
	'.mov': 'video/quicktime',
	'.f4v': 'video/mp4',
	'.f4p': 'video/mp4',
	'.ogv': 'video/ogg',
	'.webm': 'video/webm',
	'.flv': 'video/x-flv',

	'.svg': 'image/svg+xml',
	'.svgz': 'image/svg+xml',

	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.ppt': 'application/vnd.ms-powerpoint',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'.xls': 'application/vnd.ms-excel',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

	'.zip': 'application/zip',
	'.gz': 'application/x-gzip',
	'.tar.gz': 'application/x-tar',
	'.tgz': 'application/x-tar',
	'.rar': 'application/x-rar-compressed',

	'.eot': 'application/vnd.ms-fontobject',
	'.ttf': 'application/x-font-ttf',
	'.ttc': 'application/x-font-ttf',
	'.woff': 'application/x-font-woff',
	'.otf': 'font/opentype',

	'.safariextz': 'application/octet-stream',
	'.crx': 'application/x-chrome-extension',
	'.oex': 'application/x-opera-extension',
	'.swf': 'application/x-shockwave-flash',
	'.webapp': 'application/x-web-app-manifest+json',
	'.xpi': 'application/x-xpinstall',
	'.rss': 'application/xml',
	'.atom': 'application/xml',
	'.xml': 'application/xml',
	'.rdf': 'application/xml',

	'.webp': 'image/webp',
	'.ico': 'image/x-icon',

	'.appcache': 'text/cache-manifest',
	'.manifest': 'text/cache-manifest',

	'.vtt': 'text/vtt',
	'.htc': 'text/x-component',
	'.vcf': 'text/x-vcard',

	'other': 'application/octet-stream'
};

/*
 * TODO:
 * -Parse Extensions
 * -Make controllers/_Controller._headers()
 * -Parse Params
 */
module.exports = {
    common: {
		plugin: '[A-Za-z0-9][A-Za-z0-9_-]+[A-Za-z0-9]',
		controller: '[A-Za-z0-9][A-Za-z0-9_-]+[A-Za-z0-9]',
		action: '[A-Za-z0-9][A-Za-z0-9_-]+[A-Za-z0-9]',
		id: '[0-9]+',
		params: '(/[/A-Za-z0-9_-]+)*?'
	},

	add: function (path, options) {
		var i,
			defaults,
			regex	= '^/' + path.replace(/^\/|\/$/g, '');

		defaults = {
			template: path,
			plugin: options.plugin || ':plugin',
			controller: options.controller || ':controller',
			action: options.action || ':action',
			id: options.id || ':id',
			keys: []
		};

		if (!path.length || path === '/') {
			amp.config['routes']['^\/*$'] = defaults;
			return;
		}

		for (i in this.common) {
			if (regex.match(':' + i)) {
				regex = regex.replace(':' + i, '(' + this.common[i] + ')');
				defaults.keys.push(i);
			}
		}

		regex = regex + this.common.params + '/?$';
		regex = regex.replace(/\/\//g, '/');

		amp.config['routes'][regex] = defaults;
	},

	resolve: function (req, resp) {
		var _this	= module.exports,
			path	= require('path'),
			parsed	= require('url').parse(req.url),
			fpath	= amp.constants.app_path + '/webroot' + parsed.pathname;

		// Check the host name
		if (!req.headers.host.match(new RegExp(amp.config.host))) {
			resp.writeHead(404, {'Content-Type': 'text/html'});
			resp.end();
			return;
		}

		if (req.method === 'GET' && parsed.pathname !== '/') {
			fs.exists(fpath, function (file) {
				if (file === false) {
					return _this.setUp(req, resp);
				}

				var stream = fs.createReadStream(fpath);

				stream.on('error', function (error) {
					resp.writeHead(500);
					resp.end();
				});

				resp.setHeader('Content-Type', mimeTypes[path.extname(fpath)] || mimeTypes.other);
				resp.writeHead(200);

				util.pump(stream, resp, function (error) {
					resp.end();
				});
			});
		} else {
			_this.setUp(req, resp);
		}
	},

	setUp: function (req, resp) {
		var parsed	= require('url').parse(req.url),
			matches	= this.getMatches(parsed.pathname);

		if (!matches.length) {
			resp.writeHead(404, {'Content-Type': mimeTypes['.html']});
			resp.end();

			console.log('No matches for: ' + parsed.pathname);

			return;
		}

		var parsedEvent	= new emitter(),
			route		= matches.pop(),
			controller	= new (require(amp.constants.app_path + '/' + route.path));

		req.data			= null;
		req.rawData			= null;
		req.files			= null;
		req.route			= route;
		controller._name	= route.controller;
		controller.request	= req;
		controller.response	= resp;

		controller.request.query = qs.parse(parsed.query);

		parsedEvent.on('parseEnd', function () {
			controller._init.call(controller);
			controller._common.call(controller);
			controller[route.action].apply(controller, route.params);
		});

		if (req.method === 'POST') {
			var body	= '',
				parsers	= 1;

			req.on('data', function (chunk) {
				body += chunk.toString();
			});

			req.on('end', function () {
				var data = qs.parse(body);

				controller.request.rawData = body;

				if (data && data.data) {
					controller.request.data = data.data;
				}

				if (!--parsers) {
					parsedEvent.emit('parseEnd');
				}
			});

			if (req.headers['content-type'].match(/multipart/i)) {
				var multipart	= require('parted').multipart,
					parser		= new multipart(req.headers['content-type']);

				parsers++;

				parser.on('error', function (error) {
					if (!--parsers) {
						parsedEvent.emit('parseEnd');
					}
				});

				parser.on('end', function () {
					if (!--parsers) {
						parsedEvent.emit('parseEnd');
					}
				});

				parser.on('part', function (field, part) {
					if (!controller.request.files) {
						controller.request.files = {};
					}

					controller.request.files[field] = part;
				});

				req.pipe(parser);
			}
		} else {
			parsedEvent.emit('parseEnd');
		}
	},

	getMatches: function (url) {
		var i, j, parts, match, params, path, controller,
			matches = [];

		for (i in amp.config['routes']) {
			if (parts = url.match(new RegExp(i))) {
				match	= amp.config['routes'][i];
				params	= parts.slice(1).filter(Boolean);

				if (match.keys.length) {
					for (j = 0; j < match.keys.length; j++) {
						match[match.keys[j]] = parts[j + 1];
						params.splice(0, 1);
					}
				}

				if (params.length === 1 && params[0].match(/\//) !== null) {
					params = params[0].split(/\//).splice(1);
				}

				path = [];

				if (match.plugin.length > 1 && match.plugin[0] !== ':') {
					path.push(match.plugin);
				}

				if (match.controller.length < 2 || match.controller[0] === ':') {
					continue;
				}

				if (match.action.length < 2 || match.action[0] === ':') {
					continue;
				}

				path.push('controllers');
				path.push(match.controller);

				path = path.join('/');

				if (fs.existsSync(amp.constants.app_path + '/' + path + '.js')) {
					controller = require(amp.constants.app_path + '/' + path);

					if (!!controller.prototype[match.action]) {
						amp.config['routes'][i].path	= path;
						amp.config['routes'][i].params	= params;

						matches.push(amp.config['routes'][i]);

						// Continue going... Routes placed below others take precedence
					}
				}
			}
		}

		return matches;
	}
};