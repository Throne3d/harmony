const { expect, sinon, Discord, winston, Harmony, PersistenceManager } = require('./imports');
const { createBot } = require('./helpers');
const path = require('path');

describe('Harmony', function() {
  describe('constructor', function() {
    it('accepts a token', function() {
      const bot = new Harmony("token");
      expect(bot.token).to.equal("token");
    });

    it('binds events', function() {
      sinon.spy(Harmony.prototype, 'bindEvents');
      const bot = new Harmony();
      expect(bot.bindEvents.callCount).to.equal(1);
      Harmony.prototype.bindEvents.restore();
    });

    it('creates a persistence manager', function() {
      const bot = new Harmony();
      expect(bot.persistenceManager).to.be.an.instanceof(PersistenceManager);
      expect(bot.persistenceManager.storage.options.dir).to.equal(path.join(process.cwd(), '.node-persist/storage'));
    });
  });

  describe('start', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    it('logs in with given token', function() {
      const bot = this.bot;
      bot.token = 'sample token';
      bot.client.login = sinon.stub();
      bot.start();
      expect(bot.client.login.args).to.deep.equal([
        ['sample token']
      ]);
    });
  });

  describe('debugifyUser', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    it('debugs a simple user', function() {
      const author = this.bot.client.newUser({
        discriminator: '1234',
        username: 'Temp',
      });
      expect(this.bot.debugifyUser(author)).to.equal('Temp#1234');
    });

    it('debugs a bot user', function() {
      const author = this.bot.client.newUser({
        discriminator: '1235',
        username: 'Example',
        bot: true,
      });
      expect(this.bot.debugifyUser(author)).to.equal('Example#1235 [BOT]');
    });
  });

  describe('debugifyMessage', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    it('debugs a simple message', function() {
      const bot = this.bot;
      const author = bot.client.newUser({
        discriminator: '1234',
        username: 'Temp',
      });
      bot.client.guild.name = 'test';
      bot.client.channel.name = 'general';
      const message = bot.client.channel.newMessage({
        content: `test`,
        author,
      });
      expect(bot.debugifyMessage(message)).to.equal("test > #general – Temp#1234: test");
    });

    it('debugs a complicated message', function() {
      const bot = this.bot;
      const author = bot.client.newUser({
        discriminator: '4321',
        username: 'Temp',
      });

      const otherUser = bot.client.newUser({
        id: '123456',
        username: 'Test',
      });
      const otherMember = bot.client.guild.newGuildMember({
        nick: 'Nick',
        user: otherUser,
      });

      bot.client.guild.name = 'test guild';
      const category = bot.client.guild.newCategory({
        name: 'category',
      });
      const channel = bot.client.guild.newChannel({
        name: 'chat',
        parent_id: category.id,
      });
      const message = channel.newMessage({
        content: `test ${otherMember}`,
        mentions: new Discord.Collection([[otherUser.id, otherUser]]),
        author,
      });
      message.newAttachment();
      message.newEmbed();

      expect(bot.debugifyMessage(message)).to.equal("test guild > category > #chat – Temp#4321: test @Nick [has attachments, has embeds]");
    });

    it('debugs an inbound PM', function() {
      const bot = this.bot;
      const author = bot.client.newUser({
        discriminator: '1235',
        username: 'Temp',
      });
      const channel = bot.client.newDM({
        recipients: [{id: author.id}],
      });
      const message = channel.newMessage({
        content: 'example',
        author,
      });
      expect(bot.debugifyMessage(message)).to.equal("PM – Temp#1235: example");
    });

    it('debugs an outbound PM', function() {
      const bot = this.bot;
      bot.client.user.username = 'Harmony';
      bot.client.user.discriminator = '1236';
      const author = bot.client.newUser({
        discriminator: '1237',
        username: 'Temp'
      });
      const channel = bot.client.newDM({
        recipients: [{id: author.id}],
      });
      const message = channel.newMessage({
        content: 'example',
        author: bot.client.user,
      });
      expect(bot.debugifyMessage(message)).to.equal("PM to Temp#1237 – Harmony#1236 [BOT]: example");
    });

    it('debugs a group DM', function() {
      const bot = this.bot;
      const author = bot.client.newUser({
        discriminator: '1238',
        username: 'User'
      });
      const channel = bot.client.newGroupDM({
        recipients: [
          {id: bot.client.user.id},
          {id: author.id},
        ],
        name: 'Test group',
      });
      const message = channel.newMessage({
        content: 'short message',
        author: author,
      });
      expect(bot.debugifyMessage(message)).to.equal("Test group (Group DM) – User#1238: short message");
    });

    it('debugs a nameless group DM', function() {
      const bot = this.bot;
      const author = bot.client.newUser({
        discriminator: '1238',
        username: 'User'
      });
      const channel = bot.client.newGroupDM({
        recipients: [
          {id: bot.client.user.id},
          {id: author.id},
        ],
        name: null,
      });
      const message = channel.newMessage({
        content: 'short message',
        author: author,
      });
      expect(bot.debugifyMessage(message)).to.equal("(Group DM) – User#1238: short message");
    });
  });

  describe('getDisplayNameFor', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    context('without given user', function() {
      beforeEach(function() {
        this.bot.client.user.username = 'Test username';
      });

      it('gets username for DMs', function() {
        const dmChannel = this.bot.client.newDM();
        expect(this.bot.getDisplayNameFor(dmChannel)).to.equal('Test username');
      });

      it('gets username for group DMs', function() {
        const groupDMChannel = this.bot.client.newGroupDM();
        expect(this.bot.getDisplayNameFor(groupDMChannel)).to.equal('Test username');
      });

      it('gets nickname for guild channels', function() {
        const channel = this.bot.client.channel;
        this.bot.client.guild.member(this.bot.client.user).nickname = 'Test nickname';
        expect(this.bot.getDisplayNameFor(channel)).to.equal('Test nickname');
      });

      it('gets username fallback for guild channels', function() {
        const channel = this.bot.client.channel;
        expect(this.bot.getDisplayNameFor(channel)).to.equal('Test username');
      });
    });

    context('with given user', function() {
      beforeEach(function() {
        this.user = this.bot.client.newUser({
          username: 'Example user',
        });
      });

      it('gets username for DMs', function() {
        const dmChannel = this.bot.client.newDM();
        expect(this.bot.getDisplayNameFor(dmChannel, this.user)).to.equal('Example user');
      });

      it('gets username for group DMs', function() {
        const groupDMChannel = this.bot.client.newGroupDM();
        expect(this.bot.getDisplayNameFor(groupDMChannel, this.user)).to.equal('Example user');
      });

      it('gets nickname for guild channels', function() {
        const channel = this.bot.client.channel;
        this.bot.client.guild.newGuildMember({
          user: this.user,
          nick: 'Example nickname',
        });
        expect(this.bot.getDisplayNameFor(channel, this.user)).to.equal('Example nickname');
      });

      it('gets username fallback for guild channels', function() {
        const channel = this.bot.client.channel;
        this.bot.client.guild.newGuildMember({
          user: this.user,
        });
        expect(this.bot.getDisplayNameFor(channel, this.user)).to.equal('Example user');
      });

      it("gets username fallback if user isn't in guild channel", function() {
        const channel = this.bot.client.channel;
        expect(this.bot.getDisplayNameFor(channel, this.user)).to.equal('Example user');
      });
    });
  });

  describe('handleError', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    it('logs errors', function() {
      winston.error = sinon.stub();
      const bot = this.bot;
      bot.handleError('test error');
      expect(winston.error.args).to.deep.equal([
        ['test error']
      ]);
    });
  });

  describe('handleWarning', function() {
    beforeEach(async function() {
      this.bot = await createBot();
    });

    it('logs warnings', function() {
      winston.warn = sinon.stub();
      const bot = this.bot;
      bot.handleWarning('test warning');
      expect(winston.warn.args).to.deep.equal([
        ['test warning']
      ]);
    });
  });
});
