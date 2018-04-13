const Command = require('../command');
class PayAttentionCommand extends Command {
  constructor(bot) {
    super({
      name: 'payAttention',
      aliases: ['attention'],
      description: 'Have the bot pay more (or less) attention to you!',
      process: async (command, message) => {
        const userWantedCheck = await bot.persistenceManager.getUserData(message.author, 'wantsMoreCheck');

        if (userWantedCheck) {
          await bot.persistenceManager.setUserData(message.author, { wantsMoreCheck: false });
          return message.reply("I'll now ignore when you say my name, unless you @ me.");
        }

        await bot.persistenceManager.setUserData(message.author, { wantsMoreCheck: true });
        return message.reply("I'll now ask if you want me to respond when you say my name.");
      },
    }, bot);
  }
}
module.exports = PayAttentionCommand;
