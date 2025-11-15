# Discord Events Bot

A Discord bot built with discord.js v14 with event management capabilities and MySQL database integration.

## Features

- Slash command support
- MySQL database integration for event storage
- Automatic event announcements to a specified channel with role mentions
- Interactive "Interested" button on event announcements
- Automatic DM notifications when events start for interested users
- Live-updating interested user count on announcements
- Self-assignable notification role system
- Event management commands:
  - `/addevent` - Create events with date/time, description, and optional image
  - `/listevents` - View all upcoming events
  - `/editevent` - Edit event details and notify interested users
  - `/cancelevent` - Cancel an event and notify interested users
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
   ANNOUNCEMENT_CHANNEL_ID=your_channel_id_here
   ```

   **Note:** To get a channel ID, enable Developer Mode in Discord (User Settings > Advanced > Developer Mode), then right-click any channel and select "Copy Channel ID".

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
   - Send Messages (required for event announcements)
   - Use Slash Commands
   - Manage Roles (required for `/notifyme` command and auto-creating notification role)
   - Mention Everyone (required to mention the Events Notifier role in announcements)
6. Copy the generated URL and paste it in your browser
7. Select the server you want to add the bot to

## Project Structure

```
EventsBot/
├── commands/           # Slash command files
│   ├── addevent.js    # Event creation command
│   ├── cancelevent.js # Event cancellation command
│   ├── editevent.js   # Event editing command
│   ├── listevents.js  # List upcoming events
│   ├── notifyme.js    # Notification role management
│   ├── ping.js
│   ├── server.js
│   └── user.js
├── index.js            # Main bot file
├── eventNotifier.js    # Event notification scheduler
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

**Features:**
- Automatically posts an announcement to the configured channel (set via `ANNOUNCEMENT_CHANNEL_ID` in `.env`)
- Tags the "Events Notifier" role to notify all subscribers
- Creates the notification role automatically if it doesn't exist
- Includes event name, description, date/time, and image in the announcement
- Adds an interactive "Interested" button that users can click to express interest
- Shows live count of interested users on the announcement
- Sends DM notifications to all interested users when the event starts

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

### `/editevent`
Edit an existing event and notify all interested users about the changes.

**Options:**
- **event_id** (required) - The ID of the event to edit
- **name** (optional) - New event name
- **datetime** (optional) - New event date and time in UTC (format: `YYYY-MM-DD HH:MM` or ISO 8601)
- **description** (optional) - New event description
- **image** (optional) - New event image
- **remove_image** (optional) - Set to true to remove the current image

**Permissions:**
- Only the event creator, or users with "Manage Events" or "Administrator" permissions can edit events

**What happens when you edit:**
1. Updates the event in the database with the new information
2. Sends DM notifications to all interested users listing the changes made
3. Updates the original event announcement with the new details
4. Preserves the "Interested" button and count
5. Shows confirmation with list of changes and number of users notified

**Features:**
- Edit one or multiple fields at once
- Users receive detailed change log in their DM
- Announcement footer shows who last edited the event
- All changes are tracked and shown to users

**Note:** At least one field must be specified to edit.

Example usage:
```
/editevent event_id:123 name:"Updated Meeting Title"
/editevent event_id:123 datetime:"2024-12-26 15:00" description:"New time and details"
/editevent event_id:123 remove_image:true
```

### `/cancelevent`
Cancel an event and notify all interested users.

**Options:**
- **event_id** (required) - The ID of the event to cancel (shown in event announcements and `/listevents`)

**Permissions:**
- Only the event creator, or users with "Manage Events" or "Administrator" permissions can cancel events

**What happens when you cancel:**
1. Sends DM notifications to all interested users about the cancellation
2. Deletes the original event announcement from the channel
3. Removes the event and all interest records from the database
4. Shows confirmation with number of users notified

**Important:**
- Does NOT ping the Events Notifier role (silent cancellation)
- Cancellation cannot be undone
- Users who were interested will receive a DM with event details and cancellation notice

Example usage:
```
/cancelevent event_id:123
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

## Event Interest System

When an event announcement is posted, users can click the **"Interested"** button to:
- Mark themselves as interested in the event
- Automatically receive a DM notification when the event starts
- See the live count of interested users update on the announcement
- Click again to remove their interest

**How it works:**
1. User clicks the "Interested" ⭐ button on an event announcement
2. Bot confirms and saves their interest to the database
3. The announcement automatically updates to show the new interested count
4. When the event start time arrives (checked every 30 seconds), the bot:
   - Posts a reply in the announcements channel tagging the Events Notifier role
   - Sends a DM to all interested users with event details
   - Marks the event as notified to prevent duplicate messages

**Channel Notification:**
When an event starts, the bot replies to the original event announcement with:
- A mention of the Events Notifier role
- "Event Starting Now!" message with an embed
- The interested user count
- This creates a clear thread showing which event is starting

**Note:** Users must have DMs enabled from server members to receive DM notifications.

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
| announcement_message_id | VARCHAR(255) | Message ID of the announcement |
| announcement_channel_id | VARCHAR(255) | Channel ID where announcement was posted |
| notifications_sent | BOOLEAN | Whether DM notifications have been sent |

### `event_interests` Table
| Column | Type | Description |
|--------|------|-------------|
| id | INT (Primary Key) | Auto-incrementing interest ID |
| event_id | INT (Foreign Key) | References events.id |
| user_id | VARCHAR(255) | Discord ID of interested user |
| guild_id | VARCHAR(255) | Discord server ID |
| created_at | TIMESTAMP | When user marked interest |

## Scripts

- `npm start` - Start the bot
- `npm run deploy` - Deploy slash commands to Discord
- `npm run setup-db` - Set up the MySQL database and tables

## Resources

- [Discord.js Guide](https://discordjs.guide/)
- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/applications)
