# Sniper Bot

A Discord application system for Staff, Middleman, Indexer, and Giveaway Hoster applications.

## Features

- Application menu with a select menu and confirmation buttons.
- Application questions are sent one at a time in DMs.
- Users can submit or cancel after answering every question.
- Submitted applications are sent to a private staff text channel.
- Both `/setup-applications` and `s!setup-applications` setup commands are supported.
- Support ticket panel with Claim a Reward, Host a Reward, and General Support options.
- A short form asks what reward the user wants to claim or host before creating a private ticket channel.
- Ticket channels are visible to the ticket creator, the bot, and optionally the configured support role.
- Tickets have a close button; the ticket owner or staff with Manage Channels can close them.
- Both `/setup-tickets` and `s!setup-tickets` setup commands are supported.
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
9. In your Discord server, run `/setup-applications` or `s!setup-applications` where the application menu should appear.
10. Run `/setup-tickets` or `s!setup-tickets` where you want the Support panel to appear.

## Environment variables

- `DISCORD_TOKEN` — bot token (required; never commit it).
- `STAFF_CHANNEL_ID` — ID of the private staff text channel receiving applications (required for submission).
- `GUILD_ID` — optional server ID reserved for future deployment configuration.
- `EMBED_COLOR` — optional embed colour in hexadecimal without `#`; defaults to Discord blurple.
- `TICKET_CATEGORY_ID` — optional Discord category ID where new tickets are created.
- `SUPPORT_ROLE_ID` — optional staff role ID that can see and be mentioned in tickets.
- `SERVER_RULES_URL` — URL for your server rules page; replace the example URL before posting the panel.
- Discord Terms of Service link is set to `https://discord.com/terms`.

## Application questions

The bot uses the questions supplied for the four categories. Staff has seven questions, Middleman nine, Indexer six, and Giveaway Hoster six.

## Notes

- Applicants must allow direct messages from server members.
- The bot needs permission to send messages in the configured staff channel.
- Keep `.env` private and never share your bot token.


## Prefix command system

All text commands use the `s!` prefix. The `s!help` command shows four categories: Moderation, Fun & Utilities, Server & Channel Tools, and Panels. Use `s!help moderation`, `s!help fun`, `s!help tools`, or `s!help panels` for a category list. The `s!helpstaff` command is intentionally not listed or implemented.

### Moderation
- `s!ban @user [reason]`, `s!hardban userID [reason]`, `s!hb userID [reason]`
- `s!kick @user [reason]`
- `s!mute @user 10m [reason]`, `s!unmute @user` (duration units: s, m, h, d; maximum 28 days)
- `s!warn @user reason`, `s!unban userID [reason]`, `s!banlist [page]`
- `s!modlogs @user|ID`, `s!modstats @user|ID`, `s!void @user|ID [case number]`
- `s!antinuke admin @user`, `s!antinuke remove @user`
- `s!nick @user nickname`, `s!clearnick @user`, `s!strip @user`

### Fun & Utilities
- `s!8ball question`, `s!cf` / `s!coinflip`, `s!afk [reason]`, `s!compliment`, `s!highfive @user`
- `s!dih [@user]`, `s!puh [@user]` (fictional, non-serious measurement commands)
- `s!snipe` / `s!s`, `s!editedsnipe` / `s!es`, `s!cs` / `s!clearsnipes`
- `s!ping`, `s!av [@user|ID]` / `s!avatar [@user|ID]`

### Server & Channel Tools
- `s!clean`, `s!purge number` / `s!p number`, `s!autoskull`
- `s!lock`, `s!unlock`, `s!serverinfo` / `s!si`
- `s!say message`, `s!say embed message`

### Panels
- `s!application` — posts the application panel in the current channel.
- `s!support` — posts the support ticket panel in the current channel.

Panel posting is restricted to server administrators. Other commands check the relevant Discord permission and bot role hierarchy.

## Notes on moderation data

Moderation cases, AFK states, snipe caches, the auto-skull channel toggle, and the anti-nuke admin allowlist are currently kept in memory. They reset when the bot restarts. The anti-nuke commands manage an allowlist only; they do not constitute a full anti-nuke detection/protection system.
