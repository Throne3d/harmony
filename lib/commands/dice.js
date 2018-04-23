const Command = require('../command');
class DiceCommand extends Command {
  constructor(bot) {
    super({
      name: 'dice',
      aliases: ['d', 'showroll', 'roll'],
      description: 'Roll a dice! Format: `XdY`. (`showroll` performs the roll and shows the individual rolls)',
      process: (command, message, argString) => {
        const showRoll = command.startsWith("showroll");

        const diceRegex = /^(\d+)d(\d+)$/;
        const match = argString.match(diceRegex);
        if (!match || match.length !== 3) {
          return message.reply("I don't understand that dice roll format.");
        }

        let [X, Y] = match.slice(1).map(x => parseInt(x, 10));
        if (X >= 500) {
          return message.reply("please use a smaller number of dice (less than 500).");
        }
        if (Y < 1) {
          return message.reply("please use dice with at least 1 face.");
        }

        var diceRolls = [];
        for (let i = 0; i < X; i++) {
          const newRoll = Math.floor(Math.random() * Y) + 1;
          diceRolls.push(newRoll);
        }

        const total = diceRolls.reduce((e, x) => e + x);

        let reply = "";
        if (X === 1) {
          reply += `result: ${total}`;
        } else if (showRoll) {
          reply += `rolls: ${diceRolls.join(", ")}\n`;
        }

        if (X > 1) {
          reply += `total: ${total}`;
        }

        return bot.longRespondTo(message, reply, `(Roll totaled ${total})`);
      },
    }, bot);
  }
}
module.exports = DiceCommand;
