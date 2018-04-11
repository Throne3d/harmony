const log = require('winston');
const Discord = require('discord.js');
const _ = require('lodash');

class Harmony {
  constructor(token) {
    log.debug("Inited!");

    this.client = new Discord.Client();
    this.bindEvents();

    this.token = token;
    this.commandPrefix = '!';
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

  getGuildMember(guild, user) {
    return guild.members.find('user', user);
  }

  performReactionWithFallback(message, reaction, fallback) {
    const promisedResponse = message.react(reaction)
      .then(react => true)
      .catch(error => {
        log.error("Failed to react:", error);
        return message.reply(fallback);
      });
    return promisedResponse;
  }

  // promises to respond to someone mentioning the bot
  processMention(message) {
    let promisedCommanded = Promise.resolve(false);

    let command = this.getMentionText(message);
    if (command) {
      promisedCommanded = this.processCommand(command, message)
        .then(commanded => {
          if (commanded) return true;
          return message.react("❔").then(_ => false);
        });
    }

    let chain = promisedCommanded.then(commanded => {
      if (commanded) return true;
      log.debug("Ignored mention:", this.debugifyMessage(message));
      return this.performReactionWithFallback(message, "👋", "(Hi!)");
    });

    return chain;
  }

  // "command" from mention (e.g. "@Harmony, help")
  getMentionText(message) {
    const displayName = this.getGuildMember(message.guild, this.client.user).displayName;
    const escapedName = _.escapeRegExp(displayName);
    const endMention = new RegExp(`(^@${escapedName},? |,? @${escapedName}[\?!.]?$)`);

    // only pay attention to strings that seem to address the bot (instead of just referencing it)
    if (!message.cleanContent.match(endMention)) return null;

    return message.cleanContent.replace(endMention, "");
  }

  // from command string (e.g. "!help")
  getCommand(message) {
    const content = message.content.trim();
    // only pay attention to commands:
    if (!content.startsWith(this.commandPrefix)) return null;

    let command = content.replace(this.commandPrefix, "");
    // ignore false positives of the form "! test" or "!!!" (must have a word character after the command character):
    if (!command.match(/^\w/)) return null;

    return command;
  }

  processGenericMessage(message) {
    let promisedCommanded = Promise.resolve(false);

    let command = this.getCommand(message);
    if (command) {
      promisedCommanded = this.processCommand(command, message)
        .then(processed => {
          if (processed) return true;
          return this.performReactionWithFallback(message, "❔", "Sorry, I don't understand what you mean.");
        });
    }

    let chain = promisedCommanded.then(commanded => {
      if (commanded) return true;
      log.debug("Ignored message:", this.debugifyMessage(message));
      return true;
    });

    return chain;
  }

  listCommands() {
    if (this.commands) return this.commands;
    this.commands = {
      help: {
        process: (command, message) => {
          let promise = message.reply("I'm afraid I don't know how to help you just yet!")
            .then(message => true);
          return promise;
        }
      },
      hello: {
        aliases: ['hi', '👋'],
        process: (command, message) => {
          return this.performReactionWithFallback(message, "👋", `Hello, ${message.author}!`);
        }
      }
    };
    return this.commands;
  }

  // promises to respond with whether it's responded to a command or not
  processCommand(command, message) {
    log.debug("Processing command:", command);
    log.debug(`(Original message: ${this.debugifyMessage(message)})`);

    let promisedResponse = Promise.resolve(false); // default if no command is performed

    const commands = this.listCommands();
    for (const candidateName of Object.keys(commands)) {
      const candidate = commands[candidateName];
      const aliases = candidate.aliases || [];
      if (command !== candidateName && aliases.indexOf(command) < 0) continue;

      promisedResponse = candidate.process(command, message);
      break;
    }

    return promisedResponse;
  }

  // overall message processing.
  processMessage(message) {
    if (this.isOwnMessage(message)) {
      log.debug("Own message:", this.debugifyMessage(message));
      return Promise.resolve(false);
    }

    const promise = this.checkMessageMentionsMe(message)
      .then(mentionsMe => {
        if (mentionsMe) return this.processMention(message);
        return this.processGenericMessage(message);
      })
      .catch(this.handleError.bind(this));
    return promise;
  }
}

exports.Harmony = Harmony;
