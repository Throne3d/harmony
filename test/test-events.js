const { expect, sinon, winston, Discord } = require('./imports');
const EventEmitter = require('events');
const { createBot, initBot } = require('./helpers');

describe('Harmony', function() {
  describe('bindEvents', function() {
    beforeEach(function() {
      this.bot = initBot();
      this.bot.client = new EventEmitter();
      this.bot.bindEvents();
    });

    it('binds to ready', function() {
      sinon.spy(winston, 'info');
      this.bot.client.emit('ready');
      expect(winston.info.args).to.deep.equal([
        ['Logged in!']
      ]);
      winston.info.restore();
    });

    const list = {
      message: 'processMessage',
      error: 'handleError',
      warn: 'handleWarning',
    };

    Object.keys(list).forEach(key => {
      const value = list[key];
      it(`binds to ${key}`, function() {
        const stub = sinon.stub(this.bot, value);
        this.bot.client.emit(key, 'arg example');
        expect(stub.args).to.deep.equal([
          ['arg example']
        ]);
        stub.restore();
      });
    });
  });

  describe('processMessage', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    it('skips own messages', function() {
      const bot = this.bot;
      const message = bot.client.channel.newMessage({ author: bot.client.user });
      return bot.processMessage(message).then(processed => {
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(processed).to.equal(false);
      });
    });

    it('processes mentions', function() {
      const bot = this.bot;
      const botUser = bot.client.user;
      const message = bot.client.channel.newMessage({
        content: `${botUser}, test`,
        mentions: new Discord.Collection([[botUser.id, botUser]])
      });
      const checkAddressStub = sinon.stub(bot, 'checkMessageAddressesMe');
      checkAddressStub.withArgs(message).resolves([true, 'test']);
      const processMentionStub = sinon.stub(bot, 'processMention');
      processMentionStub.withArgs(message, 'test').resolves(true);
      const processGenericStub = sinon.stub(bot, 'processGenericMessage');
      return bot.processMessage(message).then(processed => {
        expect(processed).to.equal(true);
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(checkAddressStub.args).to.deep.equal([
          [message]
        ]);
        expect(processMentionStub.args).to.deep.equal([
          [message, 'test']
        ]);
        expect(processGenericStub.callCount).to.equal(0);
      });
    });

    it('processes generic messages', function() {
      const bot = this.bot;
      const message = bot.client.channel.newMessage({
        content: `test`,
        mentions: new Discord.Collection([])
      });
      const checkAddressStub = sinon.stub(bot, 'checkMessageAddressesMe');
      checkAddressStub.withArgs(message).resolves([false]);
      const processMentionStub = sinon.stub(bot, 'processMention');
      const processGenericStub = sinon.stub(bot, 'processGenericMessage');
      processGenericStub.withArgs(message).resolves(true);
      return bot.processMessage(message).then(processed => {
        expect(processed).to.equal(true);
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(checkAddressStub.args).to.deep.equal([
          [message]
        ]);
        expect(processMentionStub.callCount).to.equal(0);
        expect(processGenericStub.args).to.deep.equal([
          [message]
        ]);
      });
    });
  });

  describe('processGenericMessage', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    it('processes a detected command', function() {
      const bot = this.bot;
      const message = bot.client.channel.newMessage({
        content: '!test',
        mentions: new Discord.Collection([])
      });
      const getCommandStub = sinon.stub(bot, 'getCommand');
      getCommandStub.withArgs(message).returns('test');
      const processCommandStub = sinon.stub(bot, 'processCommand');
      processCommandStub.withArgs('test', message).resolves('processed test');
      return bot.processGenericMessage(message).then(response => {
        expect(response).to.equal('processed test');
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(getCommandStub.args).to.deep.equal([
          [message]
        ]);
        expect(processCommandStub.args).to.deep.equal([
          ['test', message]
        ]);
      });
    });

    it('handles an unhandled command-like', function() {
      const bot = this.bot;
      const message = bot.client.channel.newMessage({
        content: '!nonexistent',
        mentions: new Discord.Collection([])
      });
      const getCommandStub = sinon.stub(bot, 'getCommand');
      getCommandStub.withArgs(message).returns('nonexistent');
      const processCommandStub = sinon.stub(bot, 'processCommand');
      processCommandStub.withArgs('nonexistent', message).resolves(false);
      const reactionFallbackStub = sinon.stub(bot, 'performReactionWithFallback');
      reactionFallbackStub.withArgs(message).resolves('fallback test');
      return bot.processGenericMessage(message).then(response => {
        expect(response).to.equal('fallback test');
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(getCommandStub.args).to.deep.equal([
          [message]
        ]);
        expect(processCommandStub.args).to.deep.equal([
          ['nonexistent', message]
        ]);
        expect(reactionFallbackStub.args).to.deep.equal([
          [message, "❔", "sorry, I don't understand what you mean."]
        ]);
      });
    });

    it('handles non-commands', function() {
      const bot = this.bot;
      const message = bot.client.channel.newMessage({
        content: 'message text',
        mentions: new Discord.Collection([])
      });
      const getCommandStub = sinon.stub(bot, 'getCommand');
      getCommandStub.withArgs(message).returns(null);
      const processCommandStub = sinon.stub(bot, 'processCommand');
      return bot.processGenericMessage(message).then(response => {
        expect(response).to.equal(true);
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(getCommandStub.args).to.deep.equal([
          [message]
        ]);
        expect(processCommandStub.callCount).to.equal(0);
      });
    });
  });

  describe('processMention', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    it('handles commands', function() {
      const bot = this.bot;
      const botUser = bot.client.user;
      const message = bot.client.channel.newMessage({
        content: `${botUser}, test`,
        mentions: new Discord.Collection([[botUser.id, botUser]])
      });
      const processCommandStub = sinon.stub(bot, 'processCommand');
      processCommandStub.withArgs('test', message).resolves('processed test');
      return bot.processMention(message, 'test').then(response => {
        expect(response).to.equal('processed test');
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(processCommandStub.args).to.deep.equal([
          ['test', message]
        ]);
      });
    });

    it('handles non-commands', function() {
      const bot = this.bot;
      const botUser = bot.client.user;
      const message = bot.client.channel.newMessage({
        content: `${botUser}, nonexistent`,
        mentions: new Discord.Collection([[botUser.id, botUser]])
      });
      const processCommandStub = sinon.stub(bot, 'processCommand');
      processCommandStub.withArgs('nonexistent', message).resolves(false);
      const messageReactStub = sinon.stub();
      message.react = messageReactStub;
      messageReactStub.resolves(true);
      return bot.processMention(message, 'nonexistent').then(response => {
        expect(response).to.equal(false);
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(processCommandStub.args).to.deep.equal([
          ['nonexistent', message]
        ]);
        expect(messageReactStub.args).to.deep.equal([
          ['❔']
        ]);
      });
    });
  });
});
