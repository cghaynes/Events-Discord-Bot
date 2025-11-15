require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Events, Collection, EmbedBuilder } = require('discord.js');
const { testConnection, pool } = require('./database');
const { startEventNotifier } = require('./eventNotifier');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ]
});

// Initialize commands collection
client.commands = new Collection();

// Load commands from the commands folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[INFO] Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, async readyClient => {
    console.log(`✅ Bot is online! Logged in as ${readyClient.user.tag}`);
    console.log(`📊 Serving ${readyClient.guilds.cache.size} server(s)`);

    // Test database connection
    await testConnection();

    // Start event notification system
    startEventNotifier(readyClient);
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }

    // Handle button interactions
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('event_interested_')) {
            try {
                const eventId = parseInt(interaction.customId.replace('event_interested_', ''));

                // Check if user is already interested
                const [existing] = await pool.query(
                    'SELECT * FROM event_interests WHERE event_id = ? AND user_id = ?',
                    [eventId, interaction.user.id]
                );

                if (existing.length > 0) {
                    // User is already interested, remove them
                    await pool.query(
                        'DELETE FROM event_interests WHERE event_id = ? AND user_id = ?',
                        [eventId, interaction.user.id]
                    );
                    await interaction.reply({ content: '❌ You are no longer marked as interested in this event.', ephemeral: true });
                } else {
                    // Add user to interested list
                    await pool.query(
                        'INSERT INTO event_interests (event_id, user_id, guild_id) VALUES (?, ?, ?)',
                        [eventId, interaction.user.id, interaction.guildId]
                    );
                    await interaction.reply({ content: '⭐ You are now marked as interested! You\'ll receive a DM when the event starts.', ephemeral: true });
                }

                // Update the announcement message with new count
                const [countResult] = await pool.query(
                    'SELECT COUNT(*) as count FROM event_interests WHERE event_id = ?',
                    [eventId]
                );
                const interestedCount = countResult[0].count;

                // Get event details
                const [eventRows] = await pool.query(
                    'SELECT * FROM events WHERE id = ?',
                    [eventId]
                );

                if (eventRows.length > 0 && eventRows[0].announcement_message_id) {
                    const event = eventRows[0];
                    try {
                        const channel = await interaction.guild.channels.fetch(event.announcement_channel_id);
                        const message = await channel.messages.fetch(event.announcement_message_id);

                        // Update the embed
                        const updatedEmbed = EmbedBuilder.from(message.embeds[0]);

                        // Find and update the Interested field
                        const fields = updatedEmbed.data.fields;
                        const interestedFieldIndex = fields.findIndex(f => f.name === '👥 Interested');

                        if (interestedFieldIndex !== -1) {
                            fields[interestedFieldIndex].value = `${interestedCount} ${interestedCount === 1 ? 'person' : 'people'}`;
                        }

                        await message.edit({ embeds: [updatedEmbed] });
                    } catch (updateError) {
                        console.error('Error updating announcement message:', updateError);
                    }
                }

            } catch (error) {
                console.error('Error handling interested button:', error);
                await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
            }
        }
    }
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);
