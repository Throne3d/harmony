const persist = require('node-persist');

class PersistenceManager {
  constructor(bot, config) {
    this.bot = bot;
    config = Object.assign({}, config);
    this.storage = persist.create(config);
    this.init = this.storage.init();
  }

  pathForUser(id) {
    return `user.${id}`;
  }
  async getUserData(user, attribute) {
    await this.init;

    const itemPath = this.pathForUser(user.id);
    let userData = await this.storage.getItem(itemPath);

    const defaults = {};
    userData = Object.assign(defaults, userData);
    return userData[attribute];
  }
  async setUserData(user, newData) {
    await this.init;

    const itemPath = this.pathForUser(user.id);
    let userData = await this.storage.getItem(itemPath);
    userData = Object.assign(userData || {}, newData);
    return this.storage.setItem(itemPath, userData);
  }
}

module.exports = PersistenceManager;
