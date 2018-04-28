const { expect, sinon, Discord } = require('./imports');
const { createBot } = require('./helpers');

describe('Harmony', function() {
  context('parsing', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    describe('checkMessageAddressesMe', function() {
      context('in guild channel', function() {
        it('resolves negatively for regular message', function() {
          const bot = this.bot;
          const message = bot.client.channel.newMessage({
            content: 'Some random message',
            mentions: new Discord.Collection()
          });

          return bot.checkMessageAddressesMe(message).then(([addressesMe, text]) => {
            expect(addressesMe).to.equal(false);
            expect(text).to.be.undefined;
          });
        });

        it('resolves negatively for unclear mention', function() {
          const bot = this.bot;
          const botUser = bot.client.user;
          const message = bot.client.channel.newMessage({
            content: `there is a bot named ${botUser} which responds to commands`,
            mentions: new Discord.Collection([[botUser.id, botUser]])
          });

          return bot.checkMessageAddressesMe(message).then(([addressesMe, text]) => {
            expect(addressesMe).to.equal(false);
            expect(text).to.be.undefined;
          });
        });

        it('resolves positively for clear mention', function() {
          const bot = this.bot;
          const botUser = bot.client.user;
          const message = bot.client.channel.newMessage({
            content: `${botUser}, test command`,
            mentions: new Discord.Collection([[botUser.id, botUser]])
          });

          return bot.checkMessageAddressesMe(message).then(([addressesMe, text]) => {
            expect(addressesMe).to.equal(true);
            expect(text).to.equal('test command');
          });
        });

        context('with unclear un-mention', function() {
          beforeEach(function() {
            const bot = this.bot;
            const botUser = bot.client.user;
            const botMember = bot.getMyGuildMemberIn(bot.client.guild);
            this.user = bot.client.newUser();
            this.message = bot.client.channel.newMessage({
              content: `${botMember.displayName}, here is a test`,
              mentions: new Discord.Collection([]),
              author: this.user,
            });
            this.messageWithoutName = 'here is a test';
            this.promptMessage = bot.client.channel.newMessage({
              content: 'do you want me to respond to that?',
              author: botUser,
            });
            this.promptMessage.edit = sinon.stub();
          });

          it('resolves negatively without config', async function() {
            // leave user with default settings (wantsMoreCheck is false)
            const { bot, message } = this;

            return bot.checkMessageAddressesMe(message).then(([addressesMe, text]) => {
              expect(addressesMe).to.equal(false);
              expect(text).to.be.undefined;
            });
          });

          it('checks with config and handles time out', async function() {
            const { bot, message, promptMessage, user } = this;
            await bot.persistenceManager.setUserData(user, { wantsMoreCheck: true });

            message.reply = sinon.stub().withArgs('do you want me to respond to that?').resolves(promptMessage);
            bot.emojiPrompt = sinon.stub().callsFake(function(prompt, options, target) {
              expect(prompt).to.equal(promptMessage);
              expect(options).to.deep.equal(['✅', '❎']);
              expect(target).to.equal(user);

              return Promise.resolve(new Discord.Collection());
            });

            return bot.checkMessageAddressesMe(message).then(([addressesMe, text]) => {
              expect(promptMessage.edit.args).to.deep.equal([
                ['do you want me to respond to that? (edit: assumed not)']
              ]);
              expect(addressesMe).to.equal(false);
              expect(text).to.be.undefined;
            });
          });

          it('can resolve negatively to check with config', async function() {
            const { bot, message, promptMessage, user } = this;
            await bot.persistenceManager.setUserData(user, { wantsMoreCheck: true });

            message.reply = sinon.stub().resolves(promptMessage);
            bot.emojiPrompt = sinon.stub().callsFake(function(prompt) {
              const negativeReaction = prompt.newReaction('❎', 2, true);
              return Promise.resolve(new Discord.Collection([['❎', negativeReaction]]));
            });

            return bot.checkMessageAddressesMe(message).then(([addressesMe, text]) => {
              expect(promptMessage.edit.callCount).to.equal(0);
              expect(addressesMe).to.equal(false);
              expect(text).to.be.undefined;
            });
          });

          it('can resolve positively to check with config', async function() {
            const { bot, message, messageWithoutName, promptMessage, user } = this;
            await bot.persistenceManager.setUserData(user, { wantsMoreCheck: true });

            message.reply = sinon.stub().resolves(promptMessage);
            bot.emojiPrompt = sinon.stub().callsFake(function(prompt) {
              const negativeReaction = prompt.newReaction('✅', 2, true);
              return Promise.resolve(new Discord.Collection([['✅', negativeReaction]]));
            });

            return bot.checkMessageAddressesMe(message).then(([addressesMe, text]) => {
              expect(promptMessage.edit.callCount).to.equal(0);
              expect(addressesMe).to.equal(true);
              expect(text).to.equal(messageWithoutName);
            });
          });
        });
      });

      context.skip('in DM');
      context.skip('in group DM');
    });

    describe('getCommand', function() {
      it('works with a non-command', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: 'test',
          mentions: new Discord.Collection()
        });

        expect(bot.getCommand(message)).to.be.null;
      });

      it('works with a basic command', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: '!test',
          mentions: new Discord.Collection()
        });

        expect(bot.getCommand(message)).to.equal('test');
      });

      it('works with a different command prefix', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: '?test',
          mentions: new Discord.Collection()
        });

        expect(bot.getCommand(message)).to.equal(null);
        bot.commandPrefix = '?';
        expect(bot.getCommand(message)).to.equal('test');
      });

      it('rejects probable negatives', function() {
        const bot = this.bot;
        let message;

        message = bot.client.channel.newMessage({
          content: '!!test',
          mentions: new Discord.Collection()
        });
        expect(bot.getCommand(message)).to.equal(null);

        message = bot.client.channel.newMessage({
          content: '! test',
          mentions: new Discord.Collection()
        });
        expect(bot.getCommand(message)).to.equal(null);

        message = bot.client.channel.newMessage({
          content: '!? what',
          mentions: new Discord.Collection()
        });
        expect(bot.getCommand(message)).to.equal(null);
      });
    });
  });
});
