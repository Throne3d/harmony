const Sequelize = require('sequelize');

class PersistenceManager {
  constructor(bot) {
    this.bot = bot;
    const sequelize = new Sequelize('sqlite:harmony.db', {
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },

      // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
      operatorsAliases: false,
    });

    this.storage = sequelize;
    this.init = this.initTables();
  }

  async initTables() {
    const sequelize = this.storage;
    await sequelize.sync();
    this.tables = {};
    this.tables.User = sequelize.define('user', {
      id: { type: Sequelize.STRING, primaryKey: true },
      wantsMoreCheck: Sequelize.BOOLEAN,
    });

    return sequelize.sync();
  }

  async getUserData(user, attribute) {
    await this.init;

    let userData = await this.tables.User.findById(user.id);
    userData = userData.get({plain: true});
    userData = Object.assign({}, userData);

    return userData[attribute];
  }
  async setUserData(user, newData) {
    await this.init;

    let [userData, _created] = await this.tables.User.findOrCreate({where: {id: user.id}});
    return userData.update(newData);
  }
}

module.exports = PersistenceManager;
