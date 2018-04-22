#!/usr/bin/env node
const log = require('winston');
const program = require('commander');
const Harmony = require('./harmony');

if (process.env.NODE_ENV === 'development') {
  log.level = 'debug';
}

var token;
program
  .arguments('<token>')
  .action(function(inputToken) {
    token = inputToken;
  });
program.parse(process.argv);

if (typeof token === 'undefined') throw new Error("Bot needs a token");

const bot = new Harmony(token);
bot.start();
