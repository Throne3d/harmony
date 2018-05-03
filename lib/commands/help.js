const Command = require('../command');
class HelpCommand extends Command {
  constructor(bot) {
    super({
      name: 'help',
      description: 'Get some help!',
      process: (command, message) => {
        let help = "to use my commands, either prefix the command with a `!` or 'at' me with the command (e.g. `!help`, `@" + bot.getDisplayNameFor(message.channel) + ", help`).";
        help += "\n\n";
        help += "**Commands**\n";

        const commands = bot.listCommands();
        for (const itemName of Object.keys(commands)) {
          const item = commands[itemName];
          help += item.toHelpString();
          help += "\n";
        }
        let promise = bot.longRespondTo(message, help).then(_ => true);
        return promise;
      },
    }, bot);
  }
}
module.exports = HelpCommand;
