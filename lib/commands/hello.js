const Command = require('../command');
class HelloCommand extends Command {
  constructor(bot) {
    super({
      name: 'hello',
      aliases: ['hi', '👋'],
      description: 'Get a wave!',
      process: (command, message) => {
        return bot.performReactionWithFallback(message, "👋", `hello!`);
      },
    }, bot);
  }
}
module.exports = HelloCommand;
