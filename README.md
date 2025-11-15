# Discord Events Bot

A Discord bot built with discord.js v14 with event management capabilities and MySQL database integration.

## Features

- Slash command support
- MySQL database integration for event storage
- Self-assignable notification role system
- Event management commands:
  - `/addevent` - Create events with date/time, description, and optional image
  - `/listevents` - View all upcoming events
  - `/notifyme` - Subscribe or unsubscribe to event notifications
  - `/ping` - Replies with "Pong!"
  - `/server` - Shows server information
  - `/user` - Shows user information

## Setup

### Prerequisites

- Node.js v16.11.0 or higher
- A Discord Bot Token
- MySQL 5.7 or higher (or MariaDB)

### Getting Your Bot Token

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Reset Token" and copy your bot token
5. **IMPORTANT:** Under "Privileged Gateway Intents", enable:
   - **Server Members Intent** (required for `/notifyme` command)
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

   # Database Configuration
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_database_password
   DB_NAME=eventsbot

   # Bot Configuration
   NOTIFIER_ROLE_NAME=Events Notifier
   ```

4. Set up the MySQL database:
   ```bash
   npm run setup-db
   ```
   This will create the database and tables automatically.

5. Deploy the slash commands:
   ```bash
   npm run deploy
   ```

6. Start the bot:
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
   - Manage Roles (required for `/notifyme` command)
6. Copy the generated URL and paste it in your browser
7. Select the server you want to add the bot to

## Project Structure

```
EventsBot/
├── commands/           # Slash command files
│   ├── addevent.js    # Event creation command
│   ├── listevents.js  # List upcoming events
│   ├── notifyme.js    # Notification role management
│   ├── ping.js
│   ├── server.js
│   └── user.js
├── index.js            # Main bot file
├── database.js         # Database connection pool
├── setup-database.js   # Database setup script
├── deploy-commands.js  # Script to deploy commands to Discord
├── .env               # Environment variables (not in git)
├── .env.example       # Environment variables template
├── .gitignore         # Git ignore file
├── package.json       # Node.js dependencies
└── README.md          # This file
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

## Commands

### `/addevent`
Create a new event with the following options:
- **name** (required) - The name of the event
- **datetime** (required) - Event date and time in UTC (format: `YYYY-MM-DD HH:MM` or ISO 8601)
- **description** (required) - Description of the event
- **image** (optional) - Upload an image for the event

Example usage:
```
/addevent name:"Team Meeting" datetime:"2024-12-25 18:30" description:"Discuss Q1 plans"
```

### `/listevents`
Display all upcoming events in the server.

**Options:**
- **filter** (optional) - Choose what events to display:
  - "Upcoming Only" (default) - Shows only future events
  - "All Events" - Shows all events including past ones

**Features:**
- Shows up to 10 events ordered by date
- Displays event name, description, date/time with Discord timestamps
- Shows relative time (e.g., "in 2 days")
- Marks past events with strikethrough when using "All Events" filter
- Shows Event ID for reference

Example usage:
```
/listevents
/listevents filter:All
```

### `/notifyme`
Subscribe or unsubscribe to event notifications by adding/removing the "Events Notifier" role.

**Options:**
- **action** (required) - Choose "Subscribe (Add Role)" or "Unsubscribe (Remove Role)"

**Features:**
- Automatically creates the "Events Notifier" role if it doesn't exist
- Role is mentionable so it can be used to ping subscribers about upcoming events
- Users can easily opt-in or opt-out at any time
- All responses are ephemeral (only visible to the user)

**Permissions Required:**
- The bot needs "Manage Roles" permission
- The bot's role must be higher in the hierarchy than the "Events Notifier" role

Example usage:
```
/notifyme action:Subscribe
```

**Note:** You can customize the role name by changing the `NOTIFIER_ROLE_NAME` in your `.env` file.

## Database Schema

The bot uses a MySQL database with the following structure:

### `events` Table
| Column | Type | Description |
|--------|------|-------------|
| id | INT (Primary Key) | Auto-incrementing event ID |
| event_name | VARCHAR(255) | Name of the event |
| description | TEXT | Event description |
| event_date | DATETIME | Event date and time (UTC) |
| image_url | TEXT | URL of event image (optional) |
| created_by | VARCHAR(255) | Discord ID of creator |
| created_at | TIMESTAMP | Creation timestamp |
| guild_id | VARCHAR(255) | Discord server ID |

## Scripts

- `npm start` - Start the bot
- `npm run deploy` - Deploy slash commands to Discord
- `npm run setup-db` - Set up the MySQL database and tables

## Resources

- [Discord.js Guide](https://discordjs.guide/)
- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/applications)
