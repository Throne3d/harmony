const log = require('winston');
const Discord = require('discord.js');
const lo = require('lodash');
const CommandList = require('./commands');
const { PersistenceManager } = require('./persistence');

class Harmony {
  constructor(token, _config) {
    log.debug("Inited!");

    this.client = new Discord.Client();
    this.bindEvents();

    this.token = token;
    this.commandPrefix = '!';

    this.commands = new CommandList(this);
    this.persistenceManager = new PersistenceManager(this);
  }

  start() {
    log.debug("Started!");
    this.client.login(this.token);
  }

  bindEvents() {
    const self = this;
    const client = this.client;
    client.on('ready', () => {
      log.info("Logged in!");
    });

    client.on('message', function() { self.processMessage.apply(self, arguments); });
    client.on('error', function() { self.handleError.apply(self, arguments); });
    client.on('warn', function() { self.handleWarning.apply(self, arguments); });
  }

  handleError(error) {
    if (typeof error.error !== 'undefined') { // error instanceof ErrorEvent
      error = error.error;
    }
    log.error(error);
  }

  handleWarning(warning) {
    log.warn(warning);
  }

  debugifyUser(user) {
    return [user.tag, user.bot ? '[BOT]' : ''].filter(x => x).join(' ');
  }

  debugifyMessage(message) {
    const channel = message.channel;
    let formattedChannel;
    if (channel.type === 'dm') {
      formattedChannel = 'PM';
      if (message.author === this.client.user) formattedChannel += ` to ${this.debugifyUser(channel.recipient)}`;
    } else if (channel.type === 'group') {
      formattedChannel = (channel.name ? `${channel.name} ` : '') + '(Group DM)';
    } else {
      formattedChannel = [channel.guild.name, channel.parent ? channel.parent.name : null, `#${channel.name}`].filter(x => x).join(' > ');
    }

    let formattedUserString = this.debugifyUser(message.author) + ':';

    let metadata = [];
    if (message.attachments.size > 0) metadata.push("has attachments");
    if (message.embeds.length > 0) metadata.push("has embeds");
    metadata = metadata.length > 0 ? `[${metadata.join(', ')}]` : '';

    let formattedMessage = [formattedChannel, '–', formattedUserString, message.cleanContent, metadata].filter(x => x).join(' ');
    return formattedMessage;
  }

  async emojiPrompt(message, options, target) {
    // TODO: work on messages when can't react
    const filter = (reaction, user) => {
      if (options.indexOf(reaction.emoji.name) < 0) return false;
      if (target) return user === target;
      return user !== this.client.user;
    };
    let [reactions, response] = await Promise.all([
      this.performReactions(message, options),
      message.awaitReactions(filter, { max: 1, time: 15000 }),
    ]);
    await Promise.all(reactions.map(x => x.remove()));
    return response;
  }

  // returns a promised [addressesMe, optional text]: respectively, a boolean for if the text seems to address the bot, and the string of the relevant text
  // might use user interaction to ensure the message was intentionally mentioning the bot
  async checkMessageAddressesMe(message) {
    const displayName = this.getDisplayNameFor(message.channel);
    const escapedName = lo.escapeRegExp(displayName);
    const boundaryMention = new RegExp(`(^@${escapedName}[,.?!]? |,? @${escapedName}[\\?!.]?$)`);

    if (message.mentions.users.has(this.client.user.id) && message.cleanContent.match(boundaryMention)) {
      // only pay attention to strings that seem to address the bot (instead of just referencing it)

      const mentionText = message.cleanContent.replace(boundaryMention, "");
      return [true, mentionText];
    }

    const boundedMention = new RegExp(`\\b${escapedName}\\b`);
    if (!message.content.match(boundedMention)) return [false];

    const userWantsCheck = await this.persistenceManager.getUserData(message.author, 'wantsMoreCheck');
    if (!userWantsCheck) return [false];

    const mentionWithPunctuation = new RegExp(`(\\s*[,.?!]\\s*|\\b)@?${escapedName}(\\s*[,.?!]\\s*|\\b)`);

    const prompt = await message.reply('do you want me to respond to that?');
    const reactions = await this.emojiPrompt(prompt, ['✅', '❎'], message.author);
    if (reactions.size === 0) {
      await prompt.edit(prompt.content + ' (edit: assumed not)');
      return [false];
    }
    if (!reactions.has('✅')) return [false];
    const mentionText = message.cleanContent.replace(mentionWithPunctuation, "");
    return [true, mentionText];
  }

  // note: extracted here in case we want to employ some fancy logic later
  isOwnMessage(message) {
    return message.author === this.client.user;
  }

  getDisplayNameFor(channel, user) {
    user = user || this.client.user;
    if (channel.type === 'dm' || channel.type === 'group') {
      return user.username;
    }

    const member = channel.guild.member(user);
    if (member) {
      return member.displayName;
    }
    return user.username;
  }

  isMissingPermissionsError(error) {
    return error instanceof Discord.DiscordAPIError && error.message === 'Missing Permissions';
  }
  catchMissingPermissions(fallback) {
    const self = this;
    return function missingPermissionCatcher(error) {
      if (!self.isMissingPermissionsError(error)) throw error;
      return fallback(error);
    };
  }

  // attempts to perform an array of reactions to a message
  // promises the reactions if it works, and rejects the promise otherwise
  // if any of the reactions fail, it removes all of them
  performReactions(message, reactions) {
    let promisedResponse = Promise.resolve([]);
    // uses this instead of Promise.all so the reactions are ordered:
    let reacts = [];
    for (const reaction of reactions) {
      promisedResponse = promisedResponse
        .then(_ => message.react(reaction))
        .then(react => reacts.push(react));
    }
    promisedResponse = promisedResponse
      .then(_ => reacts)
      .catch(error => {
        if (this.isMissingPermissionsError(error)) {
          log.debug(`Missing permissions to react to "${this.debugifyMessage(message)}".`);
        }
        return Promise.all(reacts.map(x => x.remove())).then(_ => { throw error; });
      });
    return promisedResponse;
  }

  // attempts to perform reaction to the message
  // promises true if the reaction succeeds
  // if it fails:
  // - if a fallback string is given, it replies with the fallback string
  // - otherwise, it promises false.
  performReactionsWithFallback(message, reactions, fallback) {
    let promisedResponse = this.performReactions(message, reactions)
      .catch(this.catchMissingPermissions(_ => message.reply(fallback)));
    return promisedResponse;
  }

  performReactionWithFallback(message, reaction, fallback) {
    return this.performReactionsWithFallback(message, [reaction], fallback);
  }

  // gives a potentially long response to a message
  // accepts a (short!) summary to post with the potential warning message.
  // if the summary is longer than 200 characters, it will be moved to the PM message!
  longRespondTo(message, text, summary) {
    const longBoundary = 1000;
    const cutoffBoundary = 3900;
    const splitLength = 1950;

    if (text.length <= longBoundary) {
      return message.reply(text);
    }

    if (summary && summary.length > 200) {
      text = `${summary}\n${text}`;
      summary = null;
    }

    let warning = "that got a long response!";

    const truncatedString = lo.truncate(text, { length: cutoffBoundary, omission: '…' });
    let truncated = truncatedString !== text;
    if (truncated) {
      warning = "that got a *really* long response!";
    }

    const splits = lo.chunk(truncatedString, splitLength).map(x => x.reduce((y, z) => y + z));
    let list = [];
    let messages = Promise.resolve();
    for (const split of splits) {
      messages = messages.then(_ => message.author.send(split))
        .then(msg => list.push(msg));
    }
    messages = messages.then(_ => list);

    warning += " I've " + (truncated ? "truncated it and " : "") + "sent you " + (splits.length === 1 ? 'a PM' : `${splits.length} PMs`) + " with it.";

    let reactionList = [];
    if (truncated) reactionList.push("❗", "☁");
    reactionList.push("📬");

    const reactAndSummary = this.performReactions(message, reactionList)
      .then(reacts => {
        if (!summary) return [reacts, null];
        return [reacts, message.reply(`${warning} ${summary}`)];
      }, _ => {
        if (summary) warning += ` ${summary}`;
        return [null, message.reply(warning)];
      });

    let promise = Promise.all([
      messages,
      reactAndSummary
    ]);
    return promise;
  }

  // promises to respond to someone mentioning the bot
  // returns with a value of whether the command, or fallback reaction-with-fallback, was successfully processed
  processMention(message, command) {
    let promisedCommanded = this.processCommand(command, message)
      .then(commanded => {
        if (commanded) return commanded;
        let reaction = message.react("❔")
          .then(_ => false)
          .catch(this.catchMissingPermissions(_ => false));
        return reaction;
      });

    return promisedCommanded;
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
          if (processed) return processed;
          return this.performReactionWithFallback(message, "❔", "sorry, I don't understand what you mean.");
        });
    }

    let chain = promisedCommanded.then(commanded => {
      if (commanded) return commanded;
      log.debug("Ignored message:", this.debugifyMessage(message));
      return true;
    });

    return chain;
  }

  listCommands() {
    return this.commands.list;
  }

  // promises to respond with whether it's responded to a command or not
  processCommand(command, message) {
    log.debug("Attempting command:", command);

    let promisedResponse = Promise.resolve(false); // default if no command is performed
    let foundCommand = false;

    const commands = this.listCommands();
    for (const candidateName of Object.keys(commands)) {
      const candidate = commands[candidateName];
      const triedNames = [candidateName].concat(candidate.aliases || []);

      let match;
      triedNames.find(trial => {
        var regex = new RegExp(`^${lo.escapeRegExp(trial)}(\\s|$)`);
        if (!command.match(regex)) return null;
        match = [trial, command.replace(regex, "")];
        return true;
      });
      if (!match) continue;
      foundCommand = true;
      const [commandName, argString] = match;
      log.debug("got a match", commandName, argString);

      promisedResponse = candidate.process(command, message, argString);
      break;
    }

    if (!foundCommand) {
      log.debug(`Found no command for original message: ${this.debugifyMessage(message)}`);
    }

    return promisedResponse;
  }

  // overall message processing.
  // promises to return whether it processed the message
  processMessage(message) {
    if (this.isOwnMessage(message)) {
      log.debug("Own message:", this.debugifyMessage(message));
      return Promise.resolve(false);
    }

    const promise = this.checkMessageAddressesMe(message)
      .then(([addressesMe, mentionText]) => {
        if (addressesMe) return this.processMention(message, mentionText);
        return this.processGenericMessage(message);
      })
      .catch(this.handleError.bind(this));
    return promise;
  }
}

module.exports = Harmony;
