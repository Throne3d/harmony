const EventEmitter = require('events');
const Discord = require('discord.js');
const sinon = require('sinon');

let nextIDs = {
  user: 1000,
  guild: 2000,
  channel: 3000,
  message: 4000,
};

function generateID(item) {
  const nextID = nextIDs[item];
  if (String(nextID)[0] !== String(nextID + 1)[0]) throw new Error(`Not enough ${item} ID space.`);
  nextIDs[item] = nextID + 1;
  return nextID;
}

class UserStub extends Discord.User {
  constructor(client, data = {}) {
    data.id = data.id || generateID('user');
    data.name = data.name || `User${data.id}`;
    data.discriminator = data.discriminator || data.id;
    super(client, data);

    this.send = client.sendMessageStub;
  }
}

class GuildStub extends Discord.Guild {
  constructor(client, data = {}) {
    data.id = data.id || generateID('guild');
    data.name = data.name || `Guild${data.id}`;
    data.emojis = data.emojis || [];
    super(client, data);
  }

  newChannel(data = {}) {
    data.guild_id = this.id;
    return this.client.dataManager.newChannel(data);
  }
}

class ChannelStub extends Discord.Channel {
  constructor(client, data = {}) {
    data.id = data.id || generateID('channel');
    data.name = data.name || `Channel${data.id}`;
    super(client, data);

    this.send = client.sendMessageStub;
    this.sendReactionStub = client.sendReactionStub;
  }

  newMessage(data) {
    return this.client.dataManager.newMessage(this, data);
  }
}

class MessageStub extends Discord.Message {
  constructor(channel, data = {}, client) {
    data.id = data.id || generateID('message');
    data.content = data.content || `test message ${data.id}`;
    data.embeds = data.embeds || [];
    data.attachments = data.attachments || [];
    super(channel, data, client);

    this.react = client.sendReactionStub;
  }
}

class ClientStub extends EventEmitter {
  constructor() {
    super();

    this.sendMessageStub = sinon.stub();
    this.sendReactionStub = sinon.stub();

    this.dataManager = new DataManagerStub(this);

    this.guilds = new Discord.Collection();
    this.channels = new Discord.Collection();
    this.users = new Discord.Collection();

    this.user = this.newUser({
      name: 'Harmony',
      bot: true,
    });
  }

  rest() {
    throw new Error("Stub must not call REST methods.");
  }

  newGuild(data) {
    return this.dataManager.newGuild(data);
  }

  newUser(data) {
    return this.dataManager.newUser(data);
  }
}

class DataManagerStub {
  constructor(client) {
    this.client = client;
  }

  newGuild(data = {}) {
    const guild = new GuildStub(this.client, data);
    this.client.guilds.set(guild.id, guild);
    return guild;
  }

  newUser(data = {}) {
    if (this.client.users.has(data.id)) return this.client.users.get(data.id);
    const user = new UserStub(this.client, data);
    this.client.users.set(user.id, user);
    return user;
  }

  newChannel(data = {}, guild) {
    /* https://github.com/discordjs/discord.js/blob/e5bd6ec150baee5ee4ca0830b80753b7c59f4844/src/client/ClientDataManager.js#L49 */
    const channel = new ChannelStub(this.client, data);
    guild = guild || this.client.guilds.get(data.guild_id);
    if (guild) {
      guild.channels.set(channel.id, channel);
    }
    this.client.channels.set(channel.id, channel);
    return channel;
  }

  newMessage(channel, data = {}) {
    const message = new MessageStub(channel, data, this.client);
    /* https://github.com/discordjs/discord.js/blob/e5bd6ec150baee5ee4ca0830b80753b7c59f4844/src/client/actions/MessageCreate.js#L33 */
    return message;
  }
}

class SimplestClientStub extends ClientStub {
  constructor() {
    super();

    this.guild = this.newGuild();
    this.channel = this.guild.newChannel();
  }
}

module.exports = {
  ClientStub,
  SimplestClientStub,
};
