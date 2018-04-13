const harmony = require('../lib/harmony');
const chai = require('chai');
const expect = chai.expect;

describe('Harmony', function() {
  describe('constructor', function() {
    it('accepts a token', function() {
      const bot = new harmony.Harmony("token");
      expect(bot.token).to.equal("token");
    });
  });
});
