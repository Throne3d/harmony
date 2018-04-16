const Discord = require('discord.js');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const { createBot } = require('./helpers');

describe('Harmony', function() {
  context('commands', function() {
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
});
