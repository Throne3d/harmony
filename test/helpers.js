const harmony = require('../lib/harmony');
const discordStub = require('./stubs/discord-stub');

function createBot(clientType) {
  clientType = clientType || 'SimplestClientStub';
  const client = discordStub[clientType];
  const bot = new harmony.Harmony('temp');
  bot.client = new client();
  bot.bindEvents();
  return bot;
}

exports.createBot = createBot;
