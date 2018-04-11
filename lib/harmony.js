const log = require('winston');
const Discord = require('discord.js');

class Harmony {
  constructor(token) {
    log.debug("Init!");

    this.client = new Discord.Client();
    this.bindEvents();

    this.token = token;
  }

  start() {
    log.debug("Start!");
    this.client.login(this.token);
  }

  bindEvents() {
    const client = this.client;
    client.on('ready', () => {
      log.debug("Log in!");
    });

    client.on('message', msg => {
      console.log(msg);
    });
  }
}

exports.Harmony = Harmony;
