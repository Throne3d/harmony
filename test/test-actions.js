const { expect, sinon, Discord } = require('./imports');
const { createBot } = require('./helpers');

describe('Harmony', function() {
  beforeEach(async function() {
    this.bot = await createBot();
  });

  context('actions', function() {
    describe('performReactions', function() {
      it('does nothing with an empty list of reactions', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: 'Some random message',
          mentions: new Discord.Collection()
        });
        return bot.performReactions(message, []).then(reacts => {
          expect(reacts).to.deep.equal([]);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });

      it('sends a single reaction', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: 'Some random message',
          mentions: new Discord.Collection()
        });
        const messageReactStub = sinon.stub();
        message.react = messageReactStub;
        const reaction = message.newReaction('👍', 1, true);
        messageReactStub.resolves(reaction);
        return bot.performReactions(message, ['👍']).then(reacts => {
          expect(reacts).to.deep.equal([reaction]);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
          expect(messageReactStub.args).to.deep.equal([
            ['👍']
          ]);
        });
      });

      it('sends multiple reactions in succession', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: 'Some random message',
          mentions: new Discord.Collection()
        });
        const messageReactStub = sinon.stub();
        message.react = messageReactStub;
        const reaction1 = message.newReaction('👍', 1, true);
        const reaction2 = message.newReaction('👎', 1, true);
        const reaction3 = message.newReaction('❗', 1, true);

        function quickPromise(count, reaction) {
          return new Promise(function(resolve) {
            setTimeout(function() {
              expect(messageReactStub.callCount).to.equal(count);
              resolve(reaction);
            }, 50);
          });
        }
        messageReactStub.withArgs('👍').callsFake(_ => quickPromise(1, reaction1));
        messageReactStub.withArgs('👎').callsFake(_ => quickPromise(2, reaction2));
        messageReactStub.withArgs('❗').callsFake(_ => quickPromise(3, reaction3));

        return bot.performReactions(message, ['👍', '👎', '❗']).then(reacts => {
          expect(reacts).to.deep.equal([reaction1, reaction2, reaction3]);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
          expect(messageReactStub.args).to.deep.equal([
            ['👍'],
            ['👎'],
            ['❗'],
          ]);
        });
      });

      it('handles an error when reacting multiple', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: 'Some random message',
          mentions: new Discord.Collection()
        });
        const messageReactStub = sinon.stub();
        message.react = messageReactStub;
        const reaction1 = message.newReaction('👍', 1, true);
        const reaction2 = message.newReaction('👎', 1, true);
        const removeStub1 = reaction1.remove = sinon.stub();
        const removeStub2 = reaction2.remove = sinon.stub();
        removeStub1.resolves(reaction1);
        removeStub2.resolves(reaction2);

        messageReactStub.withArgs('👍').resolves(reaction1);
        messageReactStub.withArgs('👎').resolves(reaction2);
        const rejection = new Discord.DiscordAPIError("", "Missing Permissions");
        messageReactStub.withArgs('❗').rejects(rejection);

        return bot.performReactions(message, ['👍', '👎', '❗']).catch(error => {
          expect(error).to.equal(rejection);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
          expect(removeStub1.callCount).to.equal(1);
          expect(removeStub2.callCount).to.equal(1);
          expect(messageReactStub.args).to.deep.equal([
            ['👍'],
            ['👎'],
            ['❗'],
          ]);
        });
      });
    });

    describe('longRespondTo', function() {
      it('sends short messages without further change', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: 'Message',
          mentions: new Discord.Collection()
        });
        message.reply = sinon.stub();
        const reply = 'successful short response';
        message.reply.resolves(reply);

        return bot.longRespondTo(message, 'short response').then(response => {
          expect(bot.client.sendMessageStub.callCount).to.equal(0);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
          expect(message.reply.args).to.deep.equal([
            ['short response']
          ]);
          expect(response).to.equal(reply);
        });
      });

      it('sends long messages as PMs in succession', function() {
        const bot = this.bot;
        const author = bot.client.newUser();
        const message = bot.client.channel.newMessage({
          content: 'Message',
          mentions: new Discord.Collection(),
          author
        });
        message.reply = sinon.stub();
        author.send = sinon.stub();

        const text = 'long response' + 'a'.repeat(2000);
        const splits = [text.substring(0, 1950), text.substring(1950)];

        const reply1 = 'first response succeeded';
        const reply2 = 'second response succeeded';

        function quickPromise(count, reply) {
          return new Promise(function(resolve) {
            setTimeout(function() {
              expect(author.send.callCount).to.equal(count);
              resolve(reply);
            }, 50);
          });
        }
        author.send.withArgs(splits[0]).callsFake(_ => quickPromise(1, reply1));
        author.send.withArgs(splits[1]).callsFake(_ => quickPromise(2, reply2));

        message.react = sinon.stub();
        message.react.callsFake((react) => Promise.resolve(react + ' succeeded'));

        return bot.longRespondTo(message, text).then(([messages, reactAndSummary]) => {
          expect(bot.client.sendMessageStub.callCount).to.equal(0);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
          expect(message.reply.callCount).to.equal(0);
          expect(author.send.args).to.deep.equal([
            [splits[0]],
            [splits[1]]
          ]);
          expect(message.react.args).to.deep.equal([
            ['📬']
          ]);
          expect(messages).to.deep.equal([reply1, reply2]);
          const [reacts, sentSummary] = reactAndSummary;
          expect(reacts).to.deep.equal(['📬 succeeded']);
          expect(sentSummary).to.be.null;
        });
      });
    });

    describe('emojiPrompt', function() {
      beforeEach(function() {
        this.message = this.bot.client.channel.newMessage({
          content: 'Message',
          mentions: new Discord.Collection()
        });
      });

      it('offers reactions to press on message', async function() {
        const { bot, message } = this;
        const reactionList = ['✅', '❎'];

        bot.performReactions = sinon.stub().withArgs(message, reactionList).resolves([]);
        message.awaitReactions = sinon.stub().resolves();

        await bot.emojiPrompt(message, reactionList);

        expect(bot.performReactions.callCount).to.equal(1);
      });

      it('returns selection', async function() {
        const { bot, message } = this;
        const reactionList = ['✅', '❎'];

        bot.performReactions = sinon.stub().withArgs(message, reactionList).resolves([]);
        message.awaitReactions = sinon.stub().resolves('test');

        const resp = await bot.emojiPrompt(message, reactionList);

        expect(bot.performReactions.callCount).to.equal(1);
        expect(message.awaitReactions.callCount).to.equal(1);
        expect(resp).to.equal('test');
      });

      it('removes own reactions on selection', async function() {
        const { bot, message } = this;
        const reactionList = ['✅', '❎'];

        const reaction1 = message.newReaction('✅', 1, true);
        reaction1.remove = sinon.stub();

        const reaction2 = message.newReaction('❎', 1, true);
        reaction2.remove = sinon.stub();

        bot.performReactions = sinon.stub().withArgs(message, reactionList).resolves([reaction1, reaction2]);
        message.awaitReactions = sinon.stub().resolves();

        await bot.emojiPrompt(message, reactionList);

        expect(bot.performReactions.callCount).to.equal(1);
        expect(message.awaitReactions.callCount).to.equal(1);
        expect(reaction1.remove.args).to.deep.equal([[]]);
        expect(reaction2.remove.args).to.deep.equal([[]]);
      });

      it('awaits reactions correctly with no target', async function() {
        const { bot, message } = this;
        const reactionList = ['✅', '❎'];

        const reaction1 = message.newReaction('✅', 1, true);
        const reaction2 = message.newReaction('❎', 1, true);
        reaction1.remove = reaction2.remove = sinon.stub();

        const botUser = bot.client.user;
        const otherUser = bot.client.newUser();
        const otherUser2 = bot.client.newUser();

        bot.performReactions = sinon.stub().withArgs(message, reactionList).resolves([reaction1, reaction2]);
        message.awaitReactions = sinon.stub().callsFake(function(filter, opts) {
          expect(opts).to.deep.equal({ max: 1, time: 15000 });
          expect(filter(reaction1, botUser)).to.equal(false);
          expect(filter(reaction2, botUser)).to.equal(false);

          reaction1.count = 2;
          expect(filter(reaction1, otherUser)).to.equal(true);
          reaction1.count = 3;
          expect(filter(reaction1, otherUser2)).to.equal(true);

          const lateBotReaction = message.newReaction('❓', 1, true);
          const lateOtherReaction = message.newReaction('❗', 1, true);
          expect(filter(lateBotReaction, botUser)).to.equal(false);
          expect(filter(lateOtherReaction, otherUser)).to.equal(false);
          return Promise.resolve();
        });

        await bot.emojiPrompt(message, reactionList);

        expect(bot.performReactions.callCount).to.equal(1);
        expect(message.awaitReactions.callCount).to.equal(1);
      });

      it('awaits reactions correctly with target', async function() {
        const { bot, message } = this;
        const reactionList = ['✅', '❎'];

        const reaction1 = message.newReaction('✅', 1, true);
        const reaction2 = message.newReaction('❎', 1, true);
        reaction1.remove = reaction2.remove = sinon.stub();

        const botUser = bot.client.user;
        const otherUser = bot.client.newUser();
        const otherUser2 = bot.client.newUser();

        bot.performReactions = sinon.stub().withArgs(message, reactionList).resolves([reaction1, reaction2]);
        message.awaitReactions = sinon.stub().callsFake(function(filter, opts) {
          expect(opts).to.deep.equal({ max: 1, time: 15000 });
          expect(filter(reaction1, botUser)).to.equal(false);
          expect(filter(reaction2, botUser)).to.equal(false);

          reaction1.count = 2;
          expect(filter(reaction1, otherUser)).to.equal(true);
          reaction1.count = 3;
          expect(filter(reaction1, otherUser2)).to.equal(false);
          return Promise.resolve();
        });

        await bot.emojiPrompt(message, reactionList, otherUser);

        expect(bot.performReactions.callCount).to.equal(1);
        expect(message.awaitReactions.callCount).to.equal(1);
      });

      it('does not perform extraneous actions', async function() {
        const { bot, message } = this;
        const reactionList = ['✅', '❎'];

        const reaction1 = message.newReaction('✅', 1, true);
        reaction1.remove = sinon.stub();

        const reaction2 = message.newReaction('❎', 1, true);
        reaction2.remove = sinon.stub();

        bot.performReactions = sinon.stub().withArgs(message, reactionList).resolves([reaction1, reaction2]);
        message.awaitReactions = sinon.stub().resolves('test');

        const resp = await bot.emojiPrompt(message, reactionList);

        expect(bot.performReactions.callCount).to.equal(1);
        expect(message.awaitReactions.callCount).to.equal(1);
        expect(resp).to.equal('test');
        expect(reaction1.remove.args).to.deep.equal([[]]);
        expect(reaction2.remove.args).to.deep.equal([[]]);

        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
      });
    });
  });
});
