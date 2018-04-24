const { expect, Discord } = require('./imports');
const { createBot } = require('./helpers');

describe('Harmony', function() {
  context('parsing', function() {
    describe('checkMessageAddressesMe', function() {
      context('in guild channel', function() {
        it('resolves negatively for regular message', function() {
          const bot = createBot();
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
          const bot = createBot();
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
          const bot = createBot();
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
      });

      context.skip('in DM');
      context.skip('in group DM');
    });

    describe('getCommand', function() {
      it('works with a non-command', function() {
        const bot = createBot();
        const message = bot.client.channel.newMessage({
          content: 'test',
          mentions: new Discord.Collection()
        });

        expect(bot.getCommand(message)).to.be.null;
      });

      it('works with a basic command', function() {
        const bot = createBot();
        const message = bot.client.channel.newMessage({
          content: '!test',
          mentions: new Discord.Collection()
        });

        expect(bot.getCommand(message)).to.equal('test');
      });

      it('works with a different command prefix', function() {
        const bot = createBot();
        const message = bot.client.channel.newMessage({
          content: '?test',
          mentions: new Discord.Collection()
        });

        expect(bot.getCommand(message)).to.equal(null);
        bot.commandPrefix = '?';
        expect(bot.getCommand(message)).to.equal('test');
      });

      it('rejects probable negatives', function() {
        const bot = createBot();
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
