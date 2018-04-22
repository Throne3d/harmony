const lo = require('lodash');

const acceptedAttributes = [
  'aliases',
  'description',
  'name',
  'process',
];

class Command {
  constructor(data, bot) {
    const unacceptedKeys = lo.difference(Object.keys(data), acceptedAttributes);
    if (unacceptedKeys.length > 0) {
      throw new Error(`Invalid command keys: ${unacceptedKeys.join(', ')}`);
    }

    // default values:
    this.aliases = [];

    const acceptedKeys = lo.intersection(acceptedAttributes, Object.keys(data));
    // set given attributes:
    acceptedKeys.forEach(key => {
      this[key] = data[key];
    });
    this.bot = bot;
  }

  toHelpString() {
    let helpString = `\`${this.name}\`: ${this.description}`;
    if (this.aliases.length > 0) {
      let aliasList = this.aliases.map(x => "`" + x + "`").join(", ");
      helpString += ` [aliased to ${aliasList}]`;
    }
    return helpString;
  }
}

module.exports = Command;
