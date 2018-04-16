const harmony = require('../lib/harmony');
const winston = require('winston');
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

  describe('start', function() {
    it('logs in with given token', function() {
      const bot = createBot();
      bot.token = 'sample token';
      bot.client.login = sinon.stub();
      bot.start();
      expect(bot.client.login.args).to.deep.equal([
        ['sample token']
      ]);
    });
  });

  describe('handleError', function() {
    it('logs errors', function() {
      winston.error = sinon.stub();
      const bot = createBot();
      bot.handleError('test error');
      expect(winston.error.args).to.deep.equal([
        ['test error']
      ]);
    });
  });

  describe('handleWarning', function() {
    it('logs warnings', function() {
      winston.warn = sinon.stub();
      const bot = createBot();
      bot.handleWarning('test warning');
      expect(winston.warn.args).to.deep.equal([
        ['test warning']
      ]);
    });
  });
});
