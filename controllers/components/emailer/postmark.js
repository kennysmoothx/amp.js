var amp			= require('amp.js'),
	postmark	= require('postmark');

module.exports = amp.Component.extend({
	options: null,
	postmark: null,

	configure: function (options) {
		this.options	= options;
		this.postmark	= postmark(options.api_key);
	},

	send: function (message, callback) {
		var i,
			email = {};

		if (message.from) {
			email.From = message.from;
		}

		if (message.to) {
			email.To = message.to;
		}

		if (message.cc) {
			email.Cc = message.cc;
		}

		if (message.bcc) {
			email.Bcc = message.bcc;
		}

		if (message.subject) {
			email.Subject = message.subject;
		}

		if (message.tag) {
			email.Tag = message.tag;
		}

		if (message.replyTo) {
			email.ReplyTo = message.replyTo;
		}

		if (message.headers) {
			email.Headers = message.headers;
		}

		if (message.html) {
			email.HtmlBody = message.html;
		}

		if (message.text) {
			email.TextBody = message.text;
		}

		if (Array.isArray(message.attachment) && message.attachment.length > 0) {
			email.Attachments = [];

			for (i in message.attachment) {
				email.Attachments.push({
					Name: message.attachment[i].name,
					Content: message.attachment[i].data.toString('base64'),
					ContentType: message.attachment[i].contentType,
				});
			}
		}

		return this.postmark.send(email, callback);
	}
});