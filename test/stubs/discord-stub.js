const EventEmitter = require('events');
const Discord = require('discord.js');
const sinon = require('sinon');

let nextIDs = {
  user: 1000,
  guild: 2000,
  channel: 3000,
  message: 4000,
  attachment: 5000,
};

function generateID(item) {
  const nextID = nextIDs[item];
  if (String(nextID)[0] !== String(nextID + 1)[0]) throw new Error(`Not enough ${item} ID space.`);
  nextIDs[item] = nextID + 1;
  return String(nextID);
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

  newGuildMember(data = {}) {
    // https://github.com/discordjs/discord.js/blob/stable/src/structures/Guild.js#L1113
    data.user = data.user || this.client.newUser(data);
    const clientMember = new Discord.GuildMember(this, data);
    this.members.set(clientMember.id, clientMember);
    return clientMember;
  }
}

class TextChannelStub extends Discord.TextChannel {
  constructor(guild, data = {}) {
    data.id = data.id || generateID('channel');
    data.name = data.name || `channel${data.id}`;
    super(guild, data);

    this.send = guild.client.sendMessageStub;
    this.sendReactionStub = guild.client.sendReactionStub;
  }

  newMessage(data) {
    data.mentions = data.mentions || new Discord.Collection();
    return this.guild.client.dataManager.newMessage(this, data);
  }
}

class MessageStub extends Discord.Message {
  constructor(channel, data = {}, client) {
    data.id = data.id || generateID('message');
    data.content = data.content || `test message ${data.id}`;
    data.embeds = data.embeds || [];
    data.attachments = data.attachments || [];
    data.author = data.author || client.dataManager.newUser();
    super(channel, data, client);

    this.react = client.sendReactionStub;
  }

  newAttachment(data = {}) {
    data.id = data.id || generateID('attachment');
    const attachment = new Discord.MessageAttachment(this, data);
    this.attachments.set(attachment.id, attachment);
    return attachment;
  }

  newEmbed(data = {}) {
    const embed = new Discord.MessageEmbed(this, data);
    this.embeds.push(embed);
    return embed;
  }
}

class DataManagerStub {
  constructor(client) {
    this.client = client;
  }

  newGuild(data = {}) {
    const guild = new GuildStub(this.client, data);

    guild.newGuildMember({ user: this.client.user });

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
    data.type = data.type || Discord.Constants.ChannelTypes.TEXT;
    let channel;
    if (data.type === Discord.Constants.ChannelTypes.DM) {
      throw new Error("DM channels not yet supported in stubs");
    } else if (data.type === Discord.Constants.ChannelTypes.GROUP_DM) {
      throw new Error("Group DM channels not yet supported in stubs");
    } else {
      guild = guild || this.client.guilds.get(data.guild_id);
      if (guild) {
        if (data.type === Discord.Constants.ChannelTypes.TEXT) {
          channel = new TextChannelStub(guild, data);
        } else {
          throw new Error("Non-text channels not yet supported in stubs");
        }
        guild.channels.set(channel.id, channel);
      }
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

class ClientStub extends EventEmitter {
  constructor() {
    super();

    this.sendMessageStub = sinon.stub();
    this.sendReactionStub = sinon.stub();

    this.dataManager = new DataManagerStub(this);

    const resolver = new Discord.Client().resolver;
    resolver.client = this;
    this.resolver = resolver;

    this.guilds = new Discord.Collection();
    this.channels = new Discord.Collection();
    this.users = new Discord.Collection();

    this.user = this.newUser({
      username: 'Harmony',
      bot: true,
    });
  }

  get rest() {
    throw new Error("Stub must not call REST methods.");
  }

  newGuild(data) {
    return this.dataManager.newGuild(data);
  }

  newUser(data) {
    return this.dataManager.newUser(data);
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
