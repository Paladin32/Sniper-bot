import 'dotenv/config';
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
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const staffChannelId = process.env.STAFF_CHANNEL_ID;
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
  new SlashCommandBuilder()
    .setName('setup-applications')
    .setDescription('Post the Sniper Bot application menu in this channel.'),
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

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  if (message.guild && message.content.trim().toLowerCase() === 's!setup-applications') {
    if (!message.member?.permissions.has('Administrator')) {
      await message.reply('Only server administrators can set up the application menu.');
      return;
    }
    await postApplicationMenu(message.channel);
    return;
  }

  if (message.guild) return;
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
    try {
      await sendQuestion(message.author, session);
    } catch (error) {
      console.error('Could not send next question:', error.message);
    }
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
        ].join('\n'),
      ),
    ],
    components: [buttons],
  });
});

client.login(token);
