const Discord = require('discord.js');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const { createBot } = require('./helpers');

describe('Harmony', function() {
  context('command functions', function() {
    describe('processCommand', function() {
      const commandName = 'test';
      const aliasName = 'word';

      function setupStubs(bot) {
        const sampleCommand = {
          aliases: [aliasName],
          process: sinon.stub().resolves('response'),
        };
        const listCommandsStub = sinon.stub(bot, 'listCommands');
        listCommandsStub.returns({ [commandName]: sampleCommand });
        return sampleCommand;
      }

      it('handles no command found', function() {
        const bot = createBot();
        const message = bot.client.channel.newMessage({
          content: '!nonexistent',
          mentions: new Discord.Collection()
        });
        setupStubs(bot);

        return bot.processCommand('nonexistent', message).then(responded => {
          expect(responded).to.equal(false);
          expect(bot.listCommands.callCount).to.equal(1);
          expect(bot.client.sendMessageStub.callCount).to.equal(0);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });

      function jointTest(command, args) {
        const commandString = `${command}` + (args ? ` ${args}` : '');
        const bot = createBot();
        const message = bot.client.channel.newMessage({
          content: `!${commandString}`,
          mentions: new Discord.Collection()
        });
        const sampleCommand = setupStubs(bot);

        return bot.processCommand(commandString, message).then(responded => {
          expect(responded).to.equal('response');
          expect(bot.listCommands.callCount).to.equal(1);
          expect(bot.client.sendMessageStub.callCount).to.equal(0);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
          expect(sampleCommand.process.args).to.deep.equal([
            [commandString, message, args]
          ]);
        });
      }

      context('with named command', function() {
        it('processes with no args', function() {
          return jointTest(commandName, '');
        });

        it('processes with args', function() {
          return jointTest(commandName, 'example args');
        });
      });

      context('with aliased command', function() {
        it('processes with no args', function() {
          return jointTest(aliasName, '');
        });

        it('processes with args', function() {
          return jointTest(aliasName, 'example args');
        });
      });
    });
  });

  context('commands', function() {
    describe('help', function() {
      beforeEach(function() {
        this.bot = createBot();
        this.command = this.bot.listCommands().help;
      });

      it('lists commands', function() {
        const bot = this.bot;
        bot.commands = {
          help: {
            description: 'Get some help!',
            process: this.command.process,
          },
          test: {
            description: 'Test command',
            aliases: ['other', 'command']
          }
        };

        const message = bot.client.channel.newMessage({
          content: '!help',
          mentions: new Discord.Collection()
        });

        const responseStub = sinon.stub(bot, 'longRespondTo').resolves(null);
        return this.command.process('help', message).then(value => {
          expect(value).to.equal(true);
          expect(responseStub.callCount).to.equal(1);
          const args = responseStub.args[0];
          expect(args.length).to.equal(2);
          expect(args[0]).to.equal(message);
          const response = args[1];
          expect(response).to.equal(
            "to use my commands, either prefix the command with a `!` or 'at' me with the command (e.g. `!help`, `@Harmony, help`).\n\n" +
            "**Commands**\n" +
            "`help`: Get some help!\n" +
            "`test`: Test command [aliased to `other`, `command`]\n"
          );
        });
      });
    });
  });
});
