# Discord Bot

A Discord bot built with discord.js v14.

## Features

- Slash command support
- Example commands included:
  - `/ping` - Replies with "Pong!"
  - `/server` - Shows server information
  - `/user` - Shows user information

## Setup

### Prerequisites

- Node.js v16.11.0 or higher
- A Discord Bot Token

### Getting Your Bot Token

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Reset Token" and copy your bot token
5. Under "Privileged Gateway Intents", enable:
   - Server Members Intent
   - Message Content Intent
6. Go to the "OAuth2" section and copy your Client ID

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory (use `.env.example` as a template):
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   ```

4. Deploy the slash commands:
   ```bash
   npm run deploy
   ```

5. Start the bot:
   ```bash
   npm start
   ```

### Inviting the Bot to Your Server

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to OAuth2 > URL Generator
4. Select scopes:
   - `bot`
   - `applications.commands`
5. Select bot permissions (at minimum):
   - Send Messages
   - Use Slash Commands
6. Copy the generated URL and paste it in your browser
7. Select the server you want to add the bot to

## Project Structure

```
EventsBot/
├── commands/          # Slash command files
│   ├── ping.js
│   ├── server.js
│   └── user.js
├── index.js           # Main bot file
├── deploy-commands.js # Script to deploy commands to Discord
├── .env              # Environment variables (not in git)
├── .env.example      # Environment variables template
├── .gitignore        # Git ignore file
├── package.json      # Node.js dependencies
└── README.md         # This file
```

## Adding New Commands

1. Create a new file in the `commands/` folder (e.g., `mycommand.js`)
2. Use this template:

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Command description'),
    async execute(interaction) {
        await interaction.reply('Your response here!');
    },
};
```

3. Run `npm run deploy` to register the new command
4. Restart the bot

## Scripts

- `npm start` - Start the bot
- `npm run deploy` - Deploy slash commands to Discord

## Resources

- [Discord.js Guide](https://discordjs.guide/)
- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/applications)
