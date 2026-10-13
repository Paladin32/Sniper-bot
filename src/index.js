import 'dotenv/config';
import { handlePrefixCommand, cacheDeletedMessage, cacheEditedMessage } from './prefixCommands.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const staffChannelId = process.env.STAFF_CHANNEL_ID;
const ticketCategoryId = process.env.TICKET_CATEGORY_ID?.trim();
const supportRoleId = process.env.SUPPORT_ROLE_ID?.trim();
const serverRulesUrl = process.env.SERVER_RULES_URL?.trim() || 'https://example.com/server-rules';
const discordTosUrl = 'https://discord.com/terms';
const guildId = process.env.GUILD_ID?.trim();
const embedColor = Number.parseInt(process.env.EMBED_COLOR || '5865F2', 16);

if (!token) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and configure it.');
  process.exit(1);
}

const APPLICATIONS = {
  staff: {
    label: 'Staff Application',
    questions: [
      'What is your Discord ID?',
      'How old are you?',
      'How active are you on Discord?',
      'Do you have any moderation experience in other servers? List them.',
      'What are your qualities?',
      'Do you understand you must remain mature and professional at all times?',
      'Would you like to add anything at the end?',
    ],
  },
  middleman: {
    label: 'Middleman Application',
    questions: [
      'What is your Discord ID?',
      'How old are you?',
      'How active are you on Discord?',
      'Do you have any middleman experience in other servers? List them.',
      'Do you have vouches? How many vouches do you have?',
      'Do you understand you will need to give collateral in case you scam?',
      'How would you handle a middleman trade?',
      'Do you have a private server?',
      'Would you like to add anything at the end?',
    ],
  },
  indexer: {
    label: 'Indexer Application',
    questions: [
      'What is your Discord ID?',
      'How old are you?',
      'How active are you on Discord?',
      'Do you have indexer experience in other servers? List them.',
      'Which base do you have for index?',
      'Would you like to add anything at the end?',
    ],
  },
  giveaway_hoster: {
    label: 'Giveaway Hoster Application',
    questions: [
      'What is your Discord ID?',
      'How old are you?',
      'How active are you on Discord?',
      'How many rewards can you host weekly?',
      'Do you understand you need to host at least one reward per week?',
      'Would you like to add anything else?',
    ],
  },
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const sessions = new Map();
const activeSessionsByUser = new Map();

const slashCommands = [
  new SlashCommandBuilder().setName('help').setDescription('Show Sniper Bot commands').addStringOption(o => o.setName('category').setDescription('Command category').addChoices({name:'Moderation',value:'moderation'},{name:'Utilities',value:'utilities'},{name:'Server tools',value:'tools'},{name:'Panels',value:'panels'})),
  new SlashCommandBuilder().setName('ping').setDescription('Show bot latency'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show server information'),
  new SlashCommandBuilder().setName('membercount').setDescription('Show server member count'),
  new SlashCommandBuilder().setName('uptime').setDescription('Show bot uptime'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Show information about a member').addUserOption(o => o.setName('user').setDescription('Member to inspect')),
  new SlashCommandBuilder().setName('avatar').setDescription('Show a user avatar').addUserOption(o => o.setName('user').setDescription('User whose avatar to show')),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addUserOption(o => o.setName('user').setDescription('Member to ban').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for the ban')),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a member').setDefaultMemberPermissions(PermissionFlagsBits.KickMembers).addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for the kick')),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true)).addStringOption(o => o.setName('duration').setDescription('Examples: 10m, 2h, 1d').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason')),
  new SlashCommandBuilder().setName('untimeout').setDescription('Remove a member timeout').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(o => o.setName('user').setDescription('Member to untimeout').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a member').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Warning reason').setRequired(true)),
  new SlashCommandBuilder().setName('purge').setDescription('Delete recent messages').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1–100)').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName('lock').setDescription('Lock this channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('unlock').setDescription('Unlock this channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addIntegerOption(o => o.setName('seconds').setDescription('0 to disable; max 21600').setMinValue(0).setMaxValue(21600).setRequired(true)),
  new SlashCommandBuilder().setName('nickname').setDescription('Change a member nickname').setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames).addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)).addStringOption(o => o.setName('name').setDescription('New nickname; use clear to remove').setRequired(true)),
  new SlashCommandBuilder().setName('announce').setDescription('Post an announcement embed').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addStringOption(o => o.setName('message').setDescription('Announcement text').setRequired(true)),
  new SlashCommandBuilder().setName('poll').setDescription('Create a yes/no poll').addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true)),
  new SlashCommandBuilder().setName('setup-applications').setDescription('Post the application menu in this channel.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('setup-tickets').setDescription('Post the support ticket panel in this channel.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('ticket-close').setDescription('Close your current ticket'),
].map(command => command.toJSON());

function makeEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(Number.isFinite(embedColor) ? embedColor : 0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Sniper’s Empire Application System" })
    .setTimestamp();
}

function confirmationEmbed(type) {
  const app = APPLICATIONS[type];
  return makeEmbed(
    'Application Confirmation',
    [
      `Are you sure you want to begin your application for **${app.label.replace(' Application', '')}**?`,
      '',
      `You will be asked **${app.questions.length} questions** through DMs.`,
      '',
      'Starting this application will cancel any application you currently have in progress.',
      '',
      'Please select an option below.',
    ].join('\n'),
  );
}

function questionEmbed(type, index) {
  const app = APPLICATIONS[type];
  return makeEmbed(
    app.label,
    [
      `Question **${index + 1}** of **${app.questions.length}**`,
      '',
      app.questions[index],
      '',
      '**Application**',
      'Please answer honestly.',
    ].join('\n'),
  );
}

function startedEmbed(type) {
  const label = APPLICATIONS[type].label.replace(' Application', '');
  return makeEmbed(
    'Application Started',
    `Your ***${label}*** **Application** has started. Your first question is below.`,
  );
}

function submissionEmbed(session) {
  const app = APPLICATIONS[session.type];
  const fields = app.questions.map((question, index) => ({
    name: `Q${index + 1}. ${question}`,
    value: session.answers[index]?.slice(0, 1024) || '*No answer provided*',
  }));
  return new EmbedBuilder()
    .setColor(Number.isFinite(embedColor) ? embedColor : 0x5865f2)
    .setTitle(`New ${app.label}`)
    .setDescription(`Applicant: <@${session.userId}> (\`${session.userId}\`)\nApplication ID: **${session.applicationId}**`)
    .addFields(fields)
    .setFooter({ text: "Sniper’s Empire Application System" })
    .setTimestamp();
}

async function sendQuestion(user, session) {
  await user.send({ embeds: [questionEmbed(session.type, session.index)] });
}

async function startApplication(interaction, type) {
  const userId = interaction.user.id;
  const previousId = activeSessionsByUser.get(userId);
  if (previousId) sessions.delete(previousId);

  const session = {
    applicationId: String(Math.floor(100000 + Math.random() * 900000)),
    userId,
    type,
    index: 0,
    answers: [],
    status: 'answering',
  };
  sessions.set(userId, session);
  activeSessionsByUser.set(userId, userId);

  try {
    await interaction.user.send({ embeds: [startedEmbed(type)] });
    await sendQuestion(interaction.user, session);
    if (interaction.guild) {
      await interaction.reply({
        content: 'Your application has started. Check your DMs to answer the questions.',
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    sessions.delete(userId);
    activeSessionsByUser.delete(userId);
    const message = 'I could not DM you. Enable direct messages from server members and try again.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    console.error('Could not start application DM:', error.message);
  }
}

async function postApplicationMenu(channel) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('application:choose')
    .setPlaceholder('Select an application type')
    .addOptions(
      Object.entries(APPLICATIONS).map(([value, app]) => ({
        label: app.label,
        value,
        description: `Start the ${app.label.toLowerCase()}`,
      })),
    );
  const row = new ActionRowBuilder().addComponents(menu);
  const embed = makeEmbed(
    'Application System',
    [
      'Choose the application you want to complete from the menu below.',
      '',
      'The application will take place in your DMs. Make sure your direct messages are enabled.',
    ].join('\n'),
  );
  await channel.send({ embeds: [embed], components: [row] });
}


function ticketPanelEmbed() {
  return makeEmbed(
    'Support',
    [
      '> Before creating a ticket, please read through our [Server Rules](' + serverRulesUrl + ') and [Discord’s Terms of Service](' + discordTosUrl + '). This ensures you know what is allowed and what isn’t.',
      '',
      '📍 **Always make sure to pick the right option.** Please select the option below that matches your request. You may be asked a few questions before your ticket is created.',
    ].join('\n'),
  );
}

async function postTicketPanel(channel) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:choose')
    .setPlaceholder('Select the reason for your ticket')
    .addOptions(
      { label: 'Claim a Reward', value: 'claim', description: 'Open a ticket to claim a reward', emoji: '🎁' },
      { label: 'Host a Reward', value: 'host', description: 'Open a ticket to host a reward', emoji: '🎉' },
      { label: 'General Support', value: 'support', description: 'Get help with something else', emoji: '💬' },
    );
  await channel.send({
    embeds: [ticketPanelEmbed()],
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

function ticketQuestionModal(type) {
  const isClaim = type === 'claim';
  const modal = new ModalBuilder()
    .setCustomId('ticket:modal:' + type)
    .setTitle(isClaim ? 'Claim a Reward' : type === 'host' ? 'Host a Reward' : 'General Support');
  const input = new TextInputBuilder()
    .setCustomId('details')
    .setLabel(isClaim ? 'What reward are you here to claim?' : type === 'host' ? 'What reward are you here to host?' : 'How can we help you?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000)
    .setPlaceholder(isClaim ? 'Describe the reward you want to claim' : type === 'host' ? 'Describe the reward you want to host' : 'Explain what you need help with');
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

async function createTicketFromModal(interaction, type) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'Tickets can only be created inside a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  const details = interaction.fields.getTextInputValue('details').trim();
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'user';
  const suffix = interaction.user.id.slice(-4);
  const channelName = `ticket-${type}-${safeName}-${suffix}`.slice(0, 90);
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
  ];
  if (supportRoleId) overwrites.push({
    id: supportRoleId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
  });

  let parent;
  if (ticketCategoryId) {
    parent = await guild.channels.fetch(ticketCategoryId).catch(() => null);
    if (!parent || parent.type !== ChannelType.GuildCategory) {
      await interaction.reply({ content: 'TICKET_CATEGORY_ID is invalid. Please contact a server administrator.', flags: MessageFlags.Ephemeral });
      return;
    }
  }
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    ...(parent ? { parent: parent.id } : {}),
    permissionOverwrites: overwrites,
    topic: `Ticket owner: ${interaction.user.id} | Type: ${type}`,
  });
  const typeLabel = type === 'claim' ? 'Claim a Reward' : type === 'host' ? 'Host a Reward' : 'General Support';
  const embed = makeEmbed(
    typeLabel,
    `Hello <@${interaction.user.id}>! A staff member will help you soon.\\n\\n**${type === 'claim' ? 'Reward to claim' : type === 'host' ? 'Reward to host' : 'Request'}:**\\n${details}`,
  );
  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
  );
  await channel.send({ content: supportRoleId ? `<@&${supportRoleId}> <@${interaction.user.id}>` : `<@${interaction.user.id}>`, embeds: [embed], components: [closeRow], allowedMentions: { users: [interaction.user.id], roles: supportRoleId ? [supportRoleId] : [] } });
  await interaction.reply({ content: `Your ticket has been created: <#${channel.id}>`, flags: MessageFlags.Ephemeral });
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Sniper Bot is online as ${readyClient.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(
      Routes.applicationCommands(readyClient.user.id),
      { body: slashCommands },
    );
    console.log('Registered /setup-applications.');
  } catch (error) {
    console.error('Could not register slash commands:', error.message);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;
      const guild = interaction.guild;
      const replyEmbed = (title, description, color) => new EmbedBuilder().setColor(color ?? (Number.isFinite(embedColor) ? embedColor : 0x5865f2)).setTitle(title).setDescription(description).setTimestamp();
      if (cmd === 'help') {
        const category = interaction.options.getString('category');
        const lists = { moderation: 'ban · kick · timeout · untimeout · warn · purge · lock · unlock · slowmode · nickname', utilities: 'ping · avatar · userinfo · serverinfo · membercount · uptime · poll', tools: 'purge · lock · unlock · slowmode · announce · nickname', panels: 'setup-applications · setup-tickets · ticket-close' };
        const all = '**Moderation**\nban, kick, timeout, untimeout, warn\n\n**Utilities**\nping, avatar, userinfo, serverinfo, membercount, uptime, poll\n\n**Server tools**\npurge, lock, unlock, slowmode, announce, nickname\n\n**Panels**\nsetup-applications, setup-tickets, ticket-close\n\nUse /help with a category to see its commands.';
        await interaction.reply({ embeds: [replyEmbed('Sniper Bot — Help', category ? (lists[category] || 'Unknown category.') : all)], flags: MessageFlags.Ephemeral }); return;
      }
      if (cmd === 'ping') { await interaction.reply({ embeds: [replyEmbed('Pong!', 'Gateway latency: **' + client.ws.ping + ' ms**\nRound-trip: **' + Math.max(0, Date.now() - interaction.createdTimestamp) + ' ms**')] }); return; }
      if (cmd === 'uptime') { const sec = Math.floor(process.uptime()); await interaction.reply({ embeds: [replyEmbed('Bot Uptime', Math.floor(sec/86400)+'d '+Math.floor(sec%86400/3600)+'h '+Math.floor(sec%3600/60)+'m '+sec%60+'s')] }); return; }
      if (cmd === 'membercount') { if (!guild) { await interaction.reply({content:'Use this command in a server.',flags:MessageFlags.Ephemeral}); return; } await interaction.reply({embeds:[replyEmbed(guild.name, 'Members: **'+guild.memberCount+'**')]}); return; }
      if (cmd === 'serverinfo') { if (!guild) { await interaction.reply({content:'Use this command in a server.',flags:MessageFlags.Ephemeral}); return; } const em=replyEmbed(guild.name+' — Server Information','Owner: <@'+guild.ownerId+'>\nMembers: '+guild.memberCount+'\nChannels: '+guild.channels.cache.size+'\nRoles: '+guild.roles.cache.size+'\nCreated: <t:'+Math.floor(guild.createdTimestamp/1000)+':D>\nServer ID: '+guild.id); if(guild.iconURL()) em.setThumbnail(guild.iconURL()); await interaction.reply({embeds:[em]}); return; }
      if (cmd === 'userinfo') { const u=interaction.options.getUser('user') || interaction.user; const gm=guild ? await guild.members.fetch(u.id).catch(()=>null) : null; const em=replyEmbed(u.tag+' — User Information','ID: '+u.id+'\nAccount created: <t:'+Math.floor(u.createdTimestamp/1000)+':F>'+(gm?'\nJoined server: <t:'+Math.floor(gm.joinedTimestamp/1000)+':F>\nRoles: '+Math.max(0,gm.roles.cache.size-1):'')); em.setThumbnail(u.displayAvatarURL({size:256})); await interaction.reply({embeds:[em]}); return; }
      if (cmd === 'avatar') { const u=interaction.options.getUser('user') || interaction.user; const url=u.displayAvatarURL({size:1024}); await interaction.reply({embeds:[replyEmbed(u.tag+' — Avatar','[Open full-size image]('+url+')').setImage(url)]}); return; }
      if (cmd === 'ticket-close') {
        if (!guild || !interaction.channel?.topic?.includes('Ticket owner: ')) { await interaction.reply({content:'This command only works inside a ticket channel.',flags:MessageFlags.Ephemeral}); return; }
        const ownerMatch=/Ticket owner: (\d+)/.exec(interaction.channel.topic || '');
        if(ownerMatch?.[1]!==interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)){await interaction.reply({content:'Only the ticket owner or staff with Manage Channels can close this ticket.',flags:MessageFlags.Ephemeral});return;}
        await interaction.reply({content:'Closing this ticket in 3 seconds…',flags:MessageFlags.Ephemeral});
        const channelToDelete=interaction.channel; setTimeout(()=>channelToDelete.delete('Ticket closed by '+interaction.user.tag).catch(console.error),3000); return;
      }
      if (cmd === 'poll') { const question=interaction.options.getString('question',true); await interaction.reply({embeds:[replyEmbed('📊 Poll',question+'\n\n👍 Yes · 👎 No')]}); const msg=await interaction.fetchReply(); await msg.react('👍').catch(()=>{}); await msg.react('👎').catch(()=>{}); return; }
      if (cmd === 'announce') { await interaction.channel.send({embeds:[replyEmbed('📢 Announcement',interaction.options.getString('message',true))]}); await interaction.reply({content:'Announcement posted.',flags:MessageFlags.Ephemeral}); return; }
      if (cmd === 'slowmode') { const seconds=interaction.options.getInteger('seconds',true); if(!interaction.channel?.setRateLimitPerUser){await interaction.reply({content:'Slowmode is unavailable in this channel.',flags:MessageFlags.Ephemeral});return;} await interaction.channel.setRateLimitPerUser(seconds,'Updated by '+interaction.user.tag); await interaction.reply({embeds:[replyEmbed('Slowmode Updated',seconds ? 'Slowmode set to **'+seconds+' seconds**.' : 'Slowmode disabled.')]}); return; }
      if (cmd === 'lock' || cmd === 'unlock') { if(!guild || !interaction.channel){await interaction.reply({content:'Use this in a server channel.',flags:MessageFlags.Ephemeral});return;} await interaction.channel.permissionOverwrites.edit(guild.roles.everyone,{SendMessages:cmd==='lock'?false:null}); await interaction.reply({embeds:[replyEmbed(cmd==='lock'?'🔒 Channel Locked':'🔓 Channel Unlocked',cmd==='lock'?'Members can no longer send messages here.':'Channel permissions restored.')]}); return; }
      if (cmd === 'purge') { const amount=interaction.options.getInteger('amount',true); if(!interaction.channel?.bulkDelete){await interaction.reply({content:'Bulk delete is unavailable here.',flags:MessageFlags.Ephemeral});return;} await interaction.deferReply({flags:MessageFlags.Ephemeral}); const deleted=await interaction.channel.bulkDelete(amount,true); await interaction.editReply('Deleted '+deleted.size+' recent messages. Messages older than 14 days cannot be bulk-deleted.'); return; }
      if (['ban','kick','timeout','untimeout','warn','nickname'].includes(cmd)) {
        if(!guild){await interaction.reply({content:'Use this command in a server.',flags:MessageFlags.Ephemeral});return;}
        const target=interaction.options.getMember('user');
        if(!target){await interaction.reply({content:'I could not find that member in this server.',flags:MessageFlags.Ephemeral});return;}
        if(target.id===interaction.user.id){await interaction.reply({content:'You cannot use this command on yourself.',flags:MessageFlags.Ephemeral});return;}
        const reason=interaction.options.getString('reason') || 'No reason provided';
        if(cmd==='ban'){if(!target.bannable){await interaction.reply({content:'I cannot ban that member. Check role hierarchy and bot permissions.',flags:MessageFlags.Ephemeral});return;} await target.ban({reason:interaction.user.tag+': '+reason}); await interaction.reply({embeds:[replyEmbed('Member Banned','User: <@'+target.id+'>\nReason: '+reason,0xed4245)]});return;}
        if(cmd==='kick'){if(!target.kickable){await interaction.reply({content:'I cannot kick that member. Check role hierarchy and bot permissions.',flags:MessageFlags.Ephemeral});return;} await target.kick(reason); await interaction.reply({embeds:[replyEmbed('Member Kicked','User: <@'+target.id+'>\nReason: '+reason,0xed4245)]});return;}
        if(cmd==='timeout'||cmd==='untimeout'){if(!target.moderatable){await interaction.reply({content:'I cannot moderate that member.',flags:MessageFlags.Ephemeral});return;} if(cmd==='untimeout'){await target.timeout(null);await interaction.reply({content:'Timeout removed for <@'+target.id+'>.'});return;} const d=interaction.options.getString('duration',true);const match=/^(\d+)(s|m|h|d)$/i.exec(d);const ms=match?Number(match[1])*({s:1000,m:60000,h:3600000,d:86400000}[match[2].toLowerCase()]):0;if(!ms||ms>2419200000){await interaction.reply({content:'Invalid duration. Use 10m, 2h, or 1d (maximum 28 days).',flags:MessageFlags.Ephemeral});return;} await target.timeout(ms,reason);await interaction.reply({embeds:[replyEmbed('Member Timed Out','User: <@'+target.id+'>\nDuration: '+d+'\nReason: '+reason,0xfee75c)]});return;}
        if(cmd==='warn'){const r=interaction.options.getString('reason',true);await target.send({embeds:[replyEmbed('Staff Warning','You received a warning in '+guild.name+'.\nReason: '+r,0xfee75c)]}).catch(()=>{});await interaction.reply({embeds:[replyEmbed('Warning Logged','Warning issued to <@'+target.id+'>. Reason: '+r)]});return;}
        if(cmd==='nickname'){const name=interaction.options.getString('name',true);if(!target.manageable){await interaction.reply({content:'I cannot manage that nickname.',flags:MessageFlags.Ephemeral});return;}await target.setNickname(name.toLowerCase()==='clear'?null:name);await interaction.reply({content:'Nickname updated for <@'+target.id+'>.'});return;}
      }
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-tickets') {
      if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'Only server administrators can set up the ticket panel.', flags: MessageFlags.Ephemeral });
        return;
      }
      await postTicketPanel(interaction.channel);
      await interaction.reply({ content: 'The support ticket panel has been posted in this channel.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-applications') {
      if (!interaction.inGuild() || !interaction.memberPermissions?.has('Administrator')) {
        await interaction.reply({
          content: 'Only server administrators can set up the application menu.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await postApplicationMenu(interaction.channel);
      await interaction.reply({
        content: 'The application menu has been posted in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:choose') {
      const type = interaction.values[0];
      if (!['claim', 'host', 'support'].includes(type)) {
        await interaction.reply({ content: 'Unknown ticket type.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.showModal(ticketQuestionModal(type));
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket:modal:')) {
      const type = interaction.customId.split(':')[2];
      if (!['claim', 'host', 'support'].includes(type)) {
        await interaction.reply({ content: 'Unknown ticket type.', flags: MessageFlags.Ephemeral });
        return;
      }
      await createTicketFromModal(interaction, type);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'ticket:close') {
      if (!interaction.inGuild() || !interaction.channel) {
        await interaction.reply({ content: 'This ticket cannot be closed here.', flags: MessageFlags.Ephemeral });
        return;
      }
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
      const isOwner = interaction.channel.topic?.includes('Ticket owner: ' + interaction.user.id);
      if (!isAdmin && !isOwner) {
        await interaction.reply({ content: 'Only the ticket owner or staff with Manage Channels can close this ticket.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ content: 'Closing this ticket in 3 seconds…', flags: MessageFlags.Ephemeral });
      const channelToDelete = interaction.channel;
      setTimeout(() => channelToDelete.delete('Ticket closed by ' + interaction.user.tag).catch(console.error), 3000);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'application:choose') {
      const type = interaction.values[0];
      if (!APPLICATIONS[type]) {
        await interaction.reply({ content: 'Unknown application type.', flags: MessageFlags.Ephemeral });
        return;
      }
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`application:confirm:${type}`)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('application:cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger),
      );
      await interaction.reply({
        embeds: [confirmationEmbed(type)],
        components: [buttons],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === 'application:cancel') {
      await interaction.update({
        content: 'Application cancelled.',
        embeds: [],
        components: [],
      });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('application:confirm:')) {
      const type = interaction.customId.split(':')[2];
      if (!APPLICATIONS[type]) {
        await interaction.reply({ content: 'Unknown application type.', flags: MessageFlags.Ephemeral });
        return;
      }
      await startApplication(interaction, type);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('application:submit:')) {
      const userId = interaction.customId.split(':')[2];
      const session = sessions.get(userId);
      if (!session || session.status !== 'review' || interaction.user.id !== userId) {
        await interaction.reply({ content: 'This application is no longer available.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!staffChannelId) {
        await interaction.reply({
          content: 'Applications are not configured yet: STAFF_CHANNEL_ID is missing.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const staffChannel = await client.channels.fetch(staffChannelId).catch(() => null);
      if (!staffChannel || staffChannel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: 'The configured staff channel was not found. Please contact a server administrator.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await staffChannel.send({ embeds: [submissionEmbed(session)] });
      sessions.delete(userId);
      activeSessionsByUser.delete(userId);
      await interaction.update({
        embeds: [makeEmbed('Application Submitted', `Your application has been submitted successfully.\nApplication ID: **${session.applicationId}**`)],
        components: [],
      });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('application:discard:')) {
      const userId = interaction.customId.split(':')[2];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: 'This button is not for you.', flags: MessageFlags.Ephemeral });
        return;
      }
      sessions.delete(userId);
      activeSessionsByUser.delete(userId);
      await interaction.update({
        embeds: [makeEmbed('Application Cancelled', 'Your application has been cancelled.')],
        components: [],
      });
    }
  } catch (error) {
    console.error('Interaction error:', error);
    const response = { content: 'Something went wrong. Please try again or contact an administrator.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
});

client.on(Events.MessageDelete, cacheDeletedMessage);
client.on(Events.MessageUpdate, cacheEditedMessage);

let warnedAboutMessageContent = false;
client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot) return;

    // Prefix commands need the privileged Message Content intent enabled in the Discord Developer Portal.
    if (message.guild && !message.content && !warnedAboutMessageContent) {
      warnedAboutMessageContent = true;
      console.error('Prefix commands may not work: Discord delivered a guild message without content. Check Developer Portal > Bot > Privileged Gateway Intents > Message Content Intent, then save and restart the bot.');
      return;
    }

    const content = message.content.trim().toLowerCase();
    if (message.guild && content === 's!setup-tickets') {
      if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
        await message.reply('Only server administrators can set up the ticket panel.');
        return;
      }
      await postTicketPanel(message.channel);
      return;
    }

    if (message.guild && content === 's!setup-applications') {
      if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
        await message.reply('Only server administrators can set up the application menu.');
        return;
      }
      await postApplicationMenu(message.channel);
      return;
    }

    if (message.guild) {
      if (content.startsWith('s!')) console.log('Prefix command received:', content.split(/\s+/)[0]);
      await handlePrefixCommand(message, {
        postApplicationMenu,
        postTicketPanel,
        client,
        makeApplicationEmbed: makeEmbed,
      });
      return;
    }
    const session = sessions.get(message.author.id);
    if (!session || session.status !== 'answering') return;

    const answer = message.content.trim();
    if (!answer) {
      await message.reply('Please send a text answer to continue.');
      return;
    }

    session.answers[session.index] = answer.slice(0, 4000);
    session.index += 1;

    if (session.index < APPLICATIONS[session.type].questions.length) {
      await sendQuestion(message.author, session).catch(error => {
        console.error('Could not send next question:', error.message);
      });
      return;
    }

    session.status = 'review';
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`application:submit:${session.userId}`)
        .setLabel('Submit')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`application:discard:${session.userId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),
    );
    await message.author.send({
      embeds: [
        makeEmbed(
          'Confirm Submission',
          [
            'Are you sure you want to Submit?',
            '',
            'You have answered all the questions. Once submitted, staff will be able to review your application.',
            '',
            `Application ID: **${session.applicationId}**`,
          ].join('\\n'),
        ),
      ],
      components: [buttons],
    });
  } catch (error) {
    console.error('MessageCreate handler error:', error);
    if (message.guild && message.content?.trim().toLowerCase().startsWith('s!')) {
      await message.reply('This command failed due to an internal error. The bot owner can check Railway deploy logs.').catch(() => {});
    }
  }
});

client.login(token);
