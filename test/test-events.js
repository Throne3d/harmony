const harmony = require('../lib/harmony');
const chai = require('chai');
const sinon = require('sinon');
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
});
