const { Harmony, Command, PersistenceManager } = require('./imports');
const discordStub = require('./stubs/discord-stub');
const path = require('path');
const fs = require('fs');
const util = require('util');
const persist = require('node-persist');

async function createBot(clientType) {
  clientType = clientType || 'SimplestClientStub';
  const client = discordStub[clientType];
  const bot = initBot();
  bot.client = new client();
  bot.persistenceManager = null;
  bot.persistenceManager = await createPersistenceManager(bot);
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

const testDataDir = '.node-persist/harmony-test/storage';

async function createPersistenceManager(bot, config, skipDataDestruction) {
  const absoluteDir = path.join(process.cwd(), path.normalize(testDataDir));
  const access = util.promisify(fs.access);
  bot = bot || createBot();
  config = Object.assign({
    dir: testDataDir,
  }, config);
  let promise = Promise.resolve(true);
  if (!skipDataDestruction) {
    promise = access(absoluteDir)
      .then(_ => {
        persist.create(config).clear();
      }, _error => {});
  }
  await promise;
  return bot.persistenceManager = new PersistenceManager(bot, config);
}

module.exports = {
  createBot,
  initBot,
  createCommand,
  createPersistenceManager,
};
