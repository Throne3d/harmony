const Discord = require('discord.js');
const winston = require('winston');

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const Harmony = require('../lib/harmony');
const Command = require('../lib/command');

module.exports = {
  Discord,
  winston,

  chai,
  expect,
  sinon,

  Harmony,
  Command,
};
