const harmony = require('../lib/harmony');
const winston = require('winston');
const EventEmitter = require('events');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

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
});
