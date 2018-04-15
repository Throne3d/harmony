const harmony = require('../lib/harmony');
const discordStub = require('./stubs/discord-stub');
const Discord = require('discord.js');
const winston = require('winston');
const EventEmitter = require('events');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

describe('Harmony', function() {
  function createBot(clientType) {
    clientType = clientType || 'SimplestClientStub';
    const client = discordStub[clientType];
    const bot = new harmony.Harmony('temp');
    bot.client = new client();
    bot.bindEvents();
    return bot;
  }

  describe('constructor', function() {
    it('accepts a token', function() {
      const bot = new harmony.Harmony("token");
      expect(bot.token).to.equal("token");
    });

    it('binds events', function() {
      sinon.spy(harmony.Harmony.prototype, 'bindEvents');
      const bot = new harmony.Harmony();
      expect(bot.bindEvents.callCount).to.equal(1);
      harmony.Harmony.prototype.bindEvents.restore();
    });
  });

  describe('bindEvents', function() {
    beforeEach(function() {
      this.bot = new harmony.Harmony('');
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
    it('skips own messages', function() {
      const bot = createBot();
      const message = bot.client.channel.newMessage({ author: bot.client.user });
      return bot.processMessage(message).then(processed => {
        expect(bot.client.sendMessageStub.callCount).to.equal(0);
        expect(bot.client.sendReactionStub.callCount).to.equal(0);
        expect(processed).to.equal(false);
      });
    });

    it('processes mentions', function() {
      const bot = createBot();
      const botUser = bot.client.user;
      const message = bot.client.channel.newMessage({
        content: `<@${botUser.id}>, test`,
        mentions: new Discord.Collection([[botUser.id, botUser]])
      });
      const checkAddressStub = sinon.stub(bot, 'checkMessageAddressesMe');
      checkAddressStub.withArgs(message).resolves([true, 'test']);
      const processMentionStub = sinon.stub(bot, 'processMention');
      processMentionStub.withArgs(message, 'test').resolves(true);
      const processGenericStub = sinon.stub(bot, 'processGenericMessage');
      return bot.processMessage(message).then(processed => {
        expect(processed).to.equal(true);
        expect(checkAddressStub.callCount).to.equal(1);
        expect(processMentionStub.callCount).to.equal(1);
        expect(processGenericStub.callCount).to.equal(0);
      });
    });

    it('processes generic messages', function() {
      const bot = createBot();
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
        expect(checkAddressStub.callCount).to.equal(1);
        expect(processMentionStub.callCount).to.equal(0);
        expect(processGenericStub.callCount).to.equal(1);
      });
    });
  });

  describe('processGenericMessage', function() {
    it('detects commands');
    it('detects non-commands');
  });

  describe('processMention', function() {
    it('detects commands');
    it('detects simple mentions');
  });

  describe('processCommand', function() {
    it('works to a basic level');
  });
});
