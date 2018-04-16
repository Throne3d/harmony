const harmony = require('../lib/harmony');
const Discord = require('discord.js');
const winston = require('winston');
const EventEmitter = require('events');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const { createBot } = require('./helpers');

describe('Harmony', function() {
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
    it('processes a detected command', function() {
      const bot = createBot();
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
      const bot = createBot();
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
      const bot = createBot();
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
    it('handles commands', function() {
      const bot = createBot();
      const botUser = bot.client.user;
      const message = bot.client.channel.newMessage({
        content: `<@${botUser.id}>, test`,
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
      const bot = createBot();
      const botUser = bot.client.user;
      const message = bot.client.channel.newMessage({
        content: `<@${botUser.id}>, nonexistent`,
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

  describe('processCommand', function() {
    it('works to a basic level');
  });
});
