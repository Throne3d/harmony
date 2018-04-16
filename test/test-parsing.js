const Discord = require('discord.js');
const chai = require('chai');
const expect = chai.expect;
const { createBot } = require('./helpers');

describe('Harmony', function() {
  context('parsing', function() {
    describe('checkMessageAddressesMe', function() {
      context('in guild channel', function() {
        it('resolves correctly for regular message', function() {
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

        it('resolves correctly for clear mention', function() {
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
  });
});
