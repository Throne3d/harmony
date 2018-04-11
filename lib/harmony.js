const log = require('winston');
const Discord = require('discord.js');

class Harmony {
  constructor(token) {
    log.debug("Inited!");

    this.client = new Discord.Client();
    this.bindEvents();

    this.token = token;
  }

  start() {
    log.debug("Started!");
    this.client.login(this.token);
  }

  bindEvents() {
    const client = this.client;
    client.on('ready', () => {
      log.info("Logged in!");
    });

    client.on('message', this.processMessage.bind(this));
  }

  handleError(error) {
    log.error(error);
  }

  handleWarning(warning) {
    log.warn(warning);
  }

  debugifyMessage(message) {
    let formattedUsername = `${message.author.tag}` + (message.author.bot ? ' [BOT]' : '');

    let metadata = [];
    if (message.attachments.find(() => true)) metadata.append("has attachments");
    if (message.embeds.find(() => true)) metadata.append("has embeds");
    metadata = metadata.join(', ');

    let formattedMessage = `${formattedUsername}: ${message.cleanContent}` + (metadata.length > 0 ? ` [${metadata}]` : '');
    return formattedMessage;
  }

  // returns a promised "mentionsMe", a boolean for if the message mentions the user
  // might use user interaction to ensure the message was intentionally mentioning the bot
  checkMessageMentionsMe(message) {
    if (message.mentions.users.has(this.client.user.id)) {
      return Promise.resolve(true);
    }

    // TODO: prompt user if they meant the bot, if they use its username?
    // Promise is so we can delay the response, pending a user interaction.
    return Promise.resolve(false);
  }

  // note: extracted here in case we want to employ some fancy logic later
  isOwnMessage(message) {
    return message.author === this.client.user;
  }

  // promises to respond to someone mentioning the bot
  processMention(message) {
    log.debug("Mentioning message:", this.debugifyMessage(message));
    var promise = message.channel.send(`Hello, ${message.author}.`);
    return promise.then(message => true);
  }

  processGenericMessage(message) {
    log.debug("Ignored message:", this.debugifyMessage(message));
    return Promise.resolve(true);
  }

  // overall message processing.
  processMessage(message) {
    if (this.isOwnMessage(message)) {
      log.debug("Own message:", this.debugifyMessage(message));
      return Promise.resolve(false);
    }

    var promise = this.checkMessageMentionsMe(message)
      .then(mentionsMe => {
        if (mentionsMe) return this.processMention(message);
        return this.processGenericMessage(message);
      })
      .catch(this.handleError.bind(this));
    return promise;
  }
}

exports.Harmony = Harmony;
