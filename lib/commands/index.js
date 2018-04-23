class CommandList {
  constructor(bot) {
    this.bot = bot;
    this._list = {};

    var list = [
      'help',
      'hello',
      'dice',
    ];
    list.forEach(commandName => {
      const commandClass = require(`./${commandName}`);
      const command = new commandClass(this.bot);
      this.addCommand(command);
    });
  }

  addCommand(command) {
    this._list[command.name] = command;
  }

  get list() {
    return this._list;
  }

  set list(value) {
    return this._list = value;
  }
}
module.exports = CommandList;
