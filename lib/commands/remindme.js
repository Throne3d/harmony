const Command = require('../command');
const timePieces = ['second', 'minute', 'hour', 'day', 'week', 'month']
  .map(x => new RegExp(`^([\\w\\s]+) (${x}s?)$`));
class RemindMeCommand extends Command {
  constructor(bot) {
    super({
      name: 'remindme',
      aliases: [],
      description: 'Remind me to do something! Format: `remindme to [do something] in [time period]`.',
      process: (command, message, argString) => {
        const match = this.matchStringParts(argString);
        if (!match) return message.reply(`sorry, I couldn't figure out when/what you wanted me to remind you!`);
        return message.reply(`I can't do this yet, but I would remind you in ${match.in} to '${match.to}'!`);
        // TODO: reminder?
      },
    }, bot);
  }

  // parses a string of the form "[in] five minutes"
  // returns null if it can't find a valid parsing
  // TODO: actually parse times properly instead of just checking a format thing
  parseTimeIn(timeInString) {
    timeInString = timeInString.trim();
    const timeMatches = timePieces.map(piece => timeInString.match(piece));
    let timeMatch = timeMatches.find(x => x);
    if (timeMatch) timeMatch = timeMatch.slice(1).map(x => `__${x}__`).join(' ');
    return timeMatch;
  }

  // turns e.g. ("in", "thing in five minutes in X") into:
  // [ ['thing ', ' five minutes in X'], ['thing in five minutes ', ' X'] ]
  generateSplitsBy(split, string) {
    let splitString, splits;
    splitString = string.split(new RegExp(`\\b${split}\\b`));
    splits = [...Array(splitString.length - 1).keys()].map(x => {
      return [splitString.slice(0, x + 1).join(split), splitString.slice(x + 1).join(split)];
    });
    return splits;
  }

  matchStringParts(argString) {
    let match;

    // TODO: add more formats, condense code
    // e.g. "in X: Y", "in X, [to] Y", "at X to Y", "on X to Y"

    // to X in Y
    if (argString.match(/^to\b/) && argString.match(/\bin\b/)) {
      let testString = argString.replace('to', '').trim();
      let splits = this.generateSplitsBy('in', testString);
      let testedSplits = splits.reverse().map(([potentialTo, potentialIn]) => {
        const timeIn = this.parseTimeIn(potentialIn);
        if (!timeIn) return null;
        return [potentialTo.trim(), timeIn];
      }).find(x => x) || [];
      let [toString, inTime] = testedSplits;

      if (inTime) match = { in: inTime, to: toString };
    }

    // in X to Y
    if (argString.match(/^in\b/) && argString.match(/\bto\b/)) {
      let testString = argString.replace('in', '').trim();
      let splits = this.generateSplitsBy('to', testString);
      let testedSplits = splits.map(([potentialIn, potentialTo]) => {
        const timeIn = this.parseTimeIn(potentialIn);
        if (!timeIn) return null;
        return [timeIn, potentialTo.trim()];
      }).find(x => x) || [];
      let [inTime, toString] = testedSplits;

      if (inTime) match = { in: inTime, to: toString };
    }

    return match;
  }
}
module.exports = RemindMeCommand;
