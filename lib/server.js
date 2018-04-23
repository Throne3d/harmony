#!/usr/bin/env node
const fs = require('fs');
const log = require('winston');
const program = require('commander');
const Harmony = require('./harmony');

if (process.env.NODE_ENV === 'development') {
  log.level = 'debug';
}

program
  .option('-t, --token <token>')
  .option('-c, --config <file>')
  .parse(process.argv);

let config = {};
if (typeof program.config !== 'undefined') {
  const configFile = fs.readFileSync(program.config, { encoding: 'utf8' });
  config = JSON.parse(configFile);
}
if (typeof program.token !== 'undefined') {
  config.token = program.token;
}

if (typeof config.token === 'undefined') {
   throw new Error("Bot needs a token");
}

const bot = new Harmony(config.token, config);
bot.start();
