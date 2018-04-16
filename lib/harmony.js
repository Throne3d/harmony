const log = require('winston');
const Discord = require('discord.js');
const lo = require('lodash');

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

  // returns a promised [addressesMe, optional text]: respectively, a boolean for if the text seems to address the bot, and the string of the relevant text
  // might use user interaction to ensure the message was intentionally mentioning the bot
  checkMessageAddressesMe(message) {
    if (message.mentions.users.has(this.client.user.id)) {
      const displayName = this.getMyGuildMemberIn(message.guild).displayName;
      const escapedName = lo.escapeRegExp(displayName);
      const endMention = new RegExp(`(^@${escapedName},? |,? @${escapedName}[\\?!.]?$)`);

      // only pay attention to strings that seem to address the bot (instead of just referencing it)
      if (!message.cleanContent.match(endMention)) return [false];

      const mentionText = message.cleanContent.replace(endMention, "");
      return Promise.resolve([true, mentionText]);
    }

    // TODO: prompt user if they meant the bot, if they use its username?
    // Promise is so we can delay the response, pending a user interaction.
    return Promise.resolve([false]);
  }

  // note: extracted here in case we want to employ some fancy logic later
  isOwnMessage(message) {
    return message.author === this.client.user;
  }

  getGuildMember(guild, user) {
    return guild.members.find('user', user);
  }

  getMyGuildMemberIn(guild) {
    return this.getGuildMember(guild, this.client.user);
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
        return Promise.all(reacts.map(x => x.remove)).then(_ => { throw error; });
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

    if (summary.length > 200) {
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
    const promiseList = splits.map(x => message.author.send(x));

    warning += " I've " + (truncated ? "truncated it and " : "") + "sent you " + (splits.length === 1 ? 'a PM' : `${splits.length} PMs`) + " with it.";

    let reactionList = [];
    if (truncated) reactionList.push("❗", "☁");
    reactionList.push("📬");

    let promise = Promise.all([
      ...promiseList,
      this.performReactions(message, reactionList)
        .then(_ => {
          if (!summary) return;
          return message.reply(`${warning} ${summary}`);
        }, _ => {
          if (summary) warning += ` ${summary}`;
          return message.reply(warning);
        })
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
    if (this.commands) return this.commands;
    this.commands = {
      help: {
        description: 'Get some help!',
        process: (command, message) => {
          let help = "to use my commands, either prefix the command with a `!` or 'at' me with the command (e.g. `!help`, `@" + this.getMyGuildMemberIn(message.guild).displayName + ", help`).";
          help += "\n\n";
          help += "**Commands**\n";

          const commands = this.listCommands();
          for (const itemName of Object.keys(commands)) {
            const item = commands[itemName];
            help += `\`${itemName}\`: ${item.description}`;
            if (item.aliases && item.aliases.length > 0) {
              let aliasList = item.aliases.map(x => "`" + x + "`").join(", ");
              help += ` [aliased to ${aliasList}]`;
            }
            help += "\n";
          }
          let promise = this.longRespondTo(message, help).then(_ => true);
          return promise;
        },
      },
      hello: {
        aliases: ['hi', '👋'],
        description: 'Get a wave!',
        process: (command, message) => {
          return this.performReactionWithFallback(message, "👋", `hello!`);
        },
      },
      dice: {
        aliases: ['d', 'showroll', 'roll'],
        description: 'Roll a dice! Format: `XdY`. (`showroll` performs the roll and shows the individual rolls)',
        process: (command, message, argString) => {
          const showRoll = command.startsWith("showroll");

          const diceRegex = /^(\d+)d(\d+)$/;
          const match = argString.match(diceRegex);
          if (!match || match.length !== 3) {
            return message.reply("I don't understand that dice roll format.");
          }

          let [X, Y] = match.slice(1);
          if (X >= 500) {
            return message.reply("please use a smaller number of dice (less than 500).");
          }
          if (Y < 1) {
            return message.reply("please use dice with at least 1 face.");
          }

          var diceRolls = [];
          for (let i = 0; i < X; i++) {
            const newRoll = Math.floor(Math.random() * Y) + 1;
            diceRolls.push(newRoll);
          }

          const total = diceRolls.reduce((e, x) => e + x);

          let reply = "";
          if (X === 1) {
            reply += `result: ${total}`;
          } else if (showRoll) {
            reply += `rolls: ${diceRolls.join(", ")}\n`;
          }

          if (X > 1) {
            reply += `total: ${total}`;
          }

          return this.longRespondTo(message, reply, `(Roll totaled ${total})`);
        },
      },
    };
    return this.commands;
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

exports.Harmony = Harmony;
