const { expect, sinon, Discord, Command } = require('./imports');
const { createBot, initBot, createCommand } = require('./helpers');

describe('Harmony', function() {
  context('command functions', function() {
    describe('processCommand', function() {
      beforeEach(async function() {
        this.bot = await createBot();
      });

      const commandName = 'test';
      const aliasName = 'word';

      function setupStubs(bot) {
        const sampleCommand = {
          aliases: [aliasName],
          process: sinon.stub().resolves('response'),
        };
        const listCommandsStub = sinon.stub(bot, 'listCommands');
        listCommandsStub.returns({ [commandName]: sampleCommand });
        return sampleCommand;
      }

      it('handles no command found', function() {
        const bot = this.bot;
        const message = bot.client.channel.newMessage({
          content: '!nonexistent',
          mentions: new Discord.Collection()
        });
        setupStubs(bot);

        return bot.processCommand('nonexistent', message).then(responded => {
          expect(responded).to.equal(false);
          expect(bot.listCommands.callCount).to.equal(1);
          expect(bot.client.sendMessageStub.callCount).to.equal(0);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });

      function jointTest(bot, command, args) {
        const commandString = `${command}` + (args ? ` ${args}` : '');
        const message = bot.client.channel.newMessage({
          content: `!${commandString}`,
          mentions: new Discord.Collection()
        });
        const sampleCommand = setupStubs(bot);

        return bot.processCommand(commandString, message).then(responded => {
          expect(responded).to.equal('response');
          expect(bot.listCommands.callCount).to.equal(1);
          expect(bot.client.sendMessageStub.callCount).to.equal(0);
          expect(bot.client.sendReactionStub.callCount).to.equal(0);
          expect(sampleCommand.process.args).to.deep.equal([
            [commandString, message, args]
          ]);
        });
      }

      context('with named command', function() {
        it('processes with no args', function() {
          return jointTest(this.bot, commandName, '');
        });

        it('processes with args', function() {
          return jointTest(this.bot, commandName, 'example args');
        });
      });

      context('with aliased command', function() {
        it('processes with no args', function() {
          return jointTest(this.bot, aliasName, '');
        });

        it('processes with args', function() {
          return jointTest(this.bot, aliasName, 'example args');
        });
      });
    });
  });

  context('commands', function() {
    describe('help', function() {
      beforeEach(async function() {
        this.bot = await createBot();
        this.command = this.bot.listCommands().help;
      });

      it('lists commands', function() {
        const bot = this.bot;
        bot.commands.list = {};
        bot.commands.addCommand(new Command({
          name: 'help',
          description: 'Get some help!',
          process: this.command.process,
        }, bot));
        bot.commands.addCommand(new Command({
          name: 'test',
          description: 'Test command',
          aliases: ['other', 'command'],
        }, bot));

        const message = bot.client.channel.newMessage({
          content: '!help',
          mentions: new Discord.Collection()
        });

        const responseStub = sinon.stub(bot, 'longRespondTo').resolves(null);
        return this.command.process('help', message).then(value => {
          expect(value).to.equal(true);
          expect(responseStub.callCount).to.equal(1);
          const args = responseStub.args[0];
          expect(args.length).to.equal(2);
          expect(args[0]).to.equal(message);
          const response = args[1];
          expect(response).to.equal(
            "to use my commands, either prefix the command with a `!` or 'at' me with the command (e.g. `!help`, `@Harmony, help`).\n\n" +
            "**Commands**\n" +
            "`help`: Get some help!\n" +
            "`test`: Test command [aliased to `other`, `command`]\n"
          );
        });
      });
    });

    describe('roll', function() {
      beforeEach(async function() {
        this.bot = await createBot();
        this.command = this.bot.listCommands().dice;
        this.randomStub = sinon.stub(Math, 'random');
      });
      afterEach(function() {
        this.randomStub.restore();
      });

      it('handles invalid formats', function() {
        const message = this.bot.client.channel.newMessage({
          content: '!roll blah',
        });
        message.reply = sinon.stub().resolves();
        return this.command.process('roll blah', message, 'blah').then(_ => {
          expect(message.reply.args).to.deep.equal([
            ["I don't understand that dice roll format."]
          ]);
          expect(this.bot.client.sendMessageStub.callCount).to.equal(0);
          expect(this.bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });

      it('handles too many dice', function() {
        const message = this.bot.client.channel.newMessage({
          content: '!roll 501d6',
        });
        message.reply = sinon.stub().resolves();
        return this.command.process('roll 501d6', message, '501d6').then(_ => {
          expect(message.reply.args).to.deep.equal([
            ["please use a smaller number of dice (less than 500)."]
          ]);
          expect(this.bot.client.sendMessageStub.callCount).to.equal(0);
          expect(this.bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });

      it('handles too few faces', function() {
        const message = this.bot.client.channel.newMessage({
          content: '!roll 6d0',
        });
        message.reply = sinon.stub().resolves();
        return this.command.process('roll 6d0', message, '6d0').then(_ => {
          expect(message.reply.args).to.deep.equal([
            ["please use dice with at least 1 face."]
          ]);
          expect(this.bot.client.sendMessageStub.callCount).to.equal(0);
          expect(this.bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });

      it('rolls once dice', function() {
        const message = this.bot.client.channel.newMessage({
          content: '!roll 1d6',
        });
        const responseStub = sinon.stub(this.bot, 'longRespondTo');
        responseStub.resolves();
        this.randomStub.returns(0.55);
        return this.command.process('roll 1d6', message, '1d6').then(_ => {
          expect(responseStub.args).to.deep.equal([
            [message, "result: 4", "(Roll totaled 4)"]
          ]);
          expect(this.bot.client.sendMessageStub.callCount).to.equal(0);
          expect(this.bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });

      it('rolls multiple dice', function() {
        const message = this.bot.client.channel.newMessage({
          content: '!roll 10d10',
        });
        const responseStub = sinon.stub(this.bot, 'longRespondTo');
        responseStub.resolves();
        this.randomStub.returns(0.55);
        return this.command.process('roll 10d10', message, '10d10').then(_ => {
          expect(responseStub.args).to.deep.equal([
            [message, "total: 60", "(Roll totaled 60)"]
          ]);
          expect(this.bot.client.sendMessageStub.callCount).to.equal(0);
          expect(this.bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });

      it('shows rolls if told', function() {
        const message = this.bot.client.channel.newMessage({
          content: '!showroll 10d10',
        });
        const responseStub = sinon.stub(this.bot, 'longRespondTo');
        responseStub.resolves();
        this.randomStub.returns(0.55);
        return this.command.process('showroll 10d10', message, '10d10').then(_ => {
          expect(responseStub.args).to.deep.equal([
            [message, `rolls: 6${', 6'.repeat(9)}\ntotal: 60`, "(Roll totaled 60)"]
          ]);
          expect(this.bot.client.sendMessageStub.callCount).to.equal(0);
          expect(this.bot.client.sendReactionStub.callCount).to.equal(0);
        });
      });
    });

    describe('payAttention', function() {
      beforeEach(async function() {
        this.bot = await createBot();
        this.command = this.bot.listCommands().payAttention;
      });

      it('enables wantsMoreCheck if previously disabled', async function() {
        const bot = this.bot;
        const message = this.bot.client.channel.newMessage({
          content: '!payAttention',
        });
        message.reply = sinon.stub().resolves();

        let wantsMoreCheck = await bot.persistenceManager.getUserData(message.author, 'wantsMoreCheck');
        expect(wantsMoreCheck).not.to.be.ok;

        await this.command.process('payAttention', message, '');
        expect(message.reply.args).to.deep.equal([
          ["I'll now ask if you want me to respond when you say my name."]
        ]);

        wantsMoreCheck = await bot.persistenceManager.getUserData(message.author, 'wantsMoreCheck');
        expect(wantsMoreCheck).to.equal(true);
      });

      it('disables wantsMoreCheck if previously enabled', async function() {
        const bot = this.bot;
        const message = this.bot.client.channel.newMessage({
          content: '!payAttention',
        });
        message.reply = sinon.stub().resolves();

        await bot.persistenceManager.setUserData(message.author, { wantsMoreCheck: true });

        await this.command.process('payAttention', message, '');
        expect(message.reply.args).to.deep.equal([
          ["I'll now ignore when you say my name, unless you @ me."]
        ]);

        let wantsMoreCheck = await bot.persistenceManager.getUserData(message.author, 'wantsMoreCheck');
        expect(wantsMoreCheck).to.equal(false);
      });
    });
  });
});

describe('Command', function() {
  describe('constructor', function() {
    it('rejects invalid parameters', function() {
      const wrap = function() {
        new Command({ invalid: 'test', description: 'test' });
      };
      expect(wrap).to.throw(Error, "Invalid command keys: invalid");
    });

    it('sets attributes with valid parameters', function() {
      const bot = initBot();
      const handler = function process() { };
      const command = new Command({
        aliases: ['test'],
        description: 'example command',
        name: 'test',
        process: handler
      }, bot);
      expect(command.aliases).to.deep.equal(['test']);
      expect(command.description).to.equal('example command');
      expect(command.process).to.equal(handler);
      expect(command.bot).to.equal(bot);
    });
  });

  describe('toHelpString', function() {
    it('processes a command without aliases', function() {
      const command = createCommand({
        description: 'test command',
        name: 'test',
      });
      expect(command.toHelpString()).to.equal("`test`: test command");
    });

    it('processes a command with aliases', function() {
      const command = createCommand({
        description: 'example command',
        name: 'example',
        aliases: ['another', 'command'],
      });
      expect(command.toHelpString()).to.equal("`example`: example command [aliased to `another`, `command`]");
    });
  });
});
