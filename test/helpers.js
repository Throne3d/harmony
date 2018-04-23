const { Harmony, Command } = require('./imports');
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

function createCommand(data, bot) {
  bot = bot || initBot();
  const commandDefaults = {
    name: 'test',
    description: 'test description',
    process: function() { throw new Error("Example command was called to process."); }
  };
  data = Object.assign({}, commandDefaults, data);
  return new Command(data, bot);
}

module.exports = {
  createBot,
  initBot,
  createCommand,
};
