const Harmony = require('../lib/harmony');
const discordStub = require('./stubs/discord-stub');

function createBot(clientType) {
  clientType = clientType || 'SimplestClientStub';
  const client = discordStub[clientType];
  const bot = initBot();
  bot.client = new client();
  bot.bindEvents();
  return bot;
}

function initBot() {
  return new Harmony('temp');
}

module.exports = {
  createBot,
  initBot,
};
