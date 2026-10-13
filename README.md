# Sniper Bot

A Discord application system for Staff, Middleman, Indexer, and Giveaway Hoster applications.

## Features

- Application menu with a select menu and confirmation buttons.
- Application questions are sent one at a time in DMs.
- Users can submit or cancel after answering every question.
- Submitted applications are sent to a private staff text channel.
- Both `/setup-applications` and `s!setup-applications` setup commands are supported.
- The setup commands are restricted to server administrators.

## Requirements

- Node.js 20 or newer
- A Discord application and bot token
- A private staff text channel in your Discord server

## Setup

1. Create a bot application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **Bot**, create/reset the token and keep it secret.
3. Enable the **Message Content Intent** in the bot's settings.
4. Invite the bot with the `bot` and `applications.commands` scopes and permissions to view/send messages, embed links, and use application commands.
5. Copy `.env.example` to `.env`.
6. Set `DISCORD_TOKEN` and `STAFF_CHANNEL_ID` in `.env`. The staff channel should be private and visible to the bot.
7. Install dependencies with `npm install`.
8. Start the bot with `npm start`.
9. In your Discord server, run `/setup-applications` or `s!setup-applications` in the channel where the application menu should appear.

## Environment variables

- `DISCORD_TOKEN` — bot token (required; never commit it).
- `STAFF_CHANNEL_ID` — ID of the private staff text channel receiving applications (required for submission).
- `GUILD_ID` — optional server ID reserved for future deployment configuration.
- `EMBED_COLOR` — optional embed colour in hexadecimal without `#`; defaults to Discord blurple.

## Application questions

The bot uses the questions supplied for the four categories. Staff has seven questions, Middleman nine, Indexer six, and Giveaway Hoster six.

## Notes

- Applicants must allow direct messages from server members.
- The bot needs permission to send messages in the configured staff channel.
- Keep `.env` private and never share your bot token.
