const { expect, PersistenceManager } = require('./imports');
const { createBot, createPersistenceManager } = require('./helpers');

describe('PersistenceManager', function() {
  describe('constructor', function() {
    it('accepts a bot', function() {
      const bot = createBot();
      const manager = new PersistenceManager(bot);
      expect(manager.bot).to.equal(bot);
      expect(manager.storage).to.be.ok;
    });

    it('eventually initializes', function() {
      const bot = createBot();
      const manager = new PersistenceManager(bot);
      return manager.init.then(_ => true);
    });
  });

  context('with users', function() {
    beforeEach(async function() {
      this.bot = createBot();
      this.manager = await createPersistenceManager(this.bot);
      this.user = this.bot.client.newUser();
    });

    describe('pathForUser', function() {
      it('returns a path', function() {
        expect(this.manager.pathForUser('1234')).to.equal('user.1234');
      });
    });

    describe('getters and setters', function() {
      it('gets defaults for known defaults');

      it('gets no data on undefined defaults', async function() {
        const data = await this.manager.getUserData(this.user, 'test');
        expect(data).to.be.undefined;
      });

      it('successfully sets and retrieves data', async function() {
        await this.manager.setUserData(this.user, { test: 'string' });
        const firstData = await this.manager.getUserData(this.user, 'test');
        expect(firstData).to.eq('string');

        await this.manager.setUserData(this.user, { test: 'second' });
        const secondData = await this.manager.getUserData(this.user, 'test');
        expect(secondData).to.eq('second');

        await this.manager.setUserData(this.user, { other: 'third' });
        const thirdDataTest = await this.manager.getUserData(this.user, 'test');
        const thirdDataOther = await this.manager.getUserData(this.user, 'other');
        expect(thirdDataTest).to.eq('second');
        expect(thirdDataOther).to.eq('third');
      });
    });
  });
});
