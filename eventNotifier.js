const { EmbedBuilder } = require('discord.js');
const { pool } = require('./database');

// Check for events starting and send notifications
async function checkAndNotifyEvents(client) {
    try {
        // Find events that are starting within the next minute and haven't been notified yet
        const [events] = await pool.query(`
            SELECT e.*,
                   (SELECT COUNT(*) FROM event_interests WHERE event_id = e.id) as interested_count
            FROM events e
            WHERE e.notifications_sent = FALSE
            AND e.event_date <= DATE_ADD(NOW(), INTERVAL 1 MINUTE)
            AND e.event_date > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        `);

        for (const event of events) {
            console.log(`[INFO] Sending notifications for event: ${event.event_name} (ID: ${event.id})`);

            // Get all interested users
            const [interests] = await pool.query(
                'SELECT user_id FROM event_interests WHERE event_id = ?',
                [event.id]
            );

            // Send DM to each interested user
            for (const interest of interests) {
                try {
                    const user = await client.users.fetch(interest.user_id);

                    const timestamp = Math.floor(new Date(event.event_date).getTime() / 1000);
                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle(`🔔 Event Starting Now: ${event.event_name}`)
                        .setDescription(event.description)
                        .addFields(
                            {
                                name: '🕐 Time',
                                value: `<t:${timestamp}:F>`,
                                inline: false
                            },
                            {
                                name: '👥 Interested',
                                value: `${event.interested_count} ${event.interested_count === 1 ? 'person' : 'people'}`,
                                inline: true
                            },
                            {
                                name: '🆔 Event ID',
                                value: `#${event.id}`,
                                inline: true
                            }
                        )
                        .setTimestamp();

                    if (event.image_url) {
                        embed.setImage(event.image_url);
                    }

                    await user.send({
                        content: '⭐ An event you\'re interested in is starting now!',
                        embeds: [embed]
                    });

                    console.log(`[INFO] Sent notification to user ${interest.user_id} for event ${event.id}`);
                } catch (dmError) {
                    console.error(`[ERROR] Failed to send DM to user ${interest.user_id}:`, dmError.message);
                    // Continue with other users even if one fails
                }
            }

            // Post announcement in the channel (reply to original message)
            if (event.announcement_channel_id && event.announcement_message_id) {
                try {
                    const guild = client.guilds.cache.get(event.guild_id);
                    if (guild) {
                        const channel = await guild.channels.fetch(event.announcement_channel_id);
                        if (channel && channel.isTextBased()) {
                            // Get the Events Notifier role
                            const roleName = process.env.NOTIFIER_ROLE_NAME || 'Events Notifier';
                            const notifierRole = guild.roles.cache.find(r => r.name === roleName);

                            // Fetch the original announcement message
                            const originalMessage = await channel.messages.fetch(event.announcement_message_id);

                            // Create the starting announcement message
                            const mentionText = notifierRole
                                ? `${notifierRole} 🎉 **Event Starting Now!**`
                                : '🎉 **Event Starting Now!**';

                            const startEmbed = new EmbedBuilder()
                                .setColor(0x00FF00)
                                .setTitle(`🔔 ${event.event_name}`)
                                .setDescription('This event is starting now!')
                                .addFields({
                                    name: '👥 Interested',
                                    value: `${event.interested_count} ${event.interested_count === 1 ? 'person is' : 'people are'} interested`,
                                    inline: true
                                })
                                .setTimestamp();

                            // Reply to the original announcement
                            await originalMessage.reply({
                                content: mentionText,
                                embeds: [startEmbed]
                            });

                            console.log(`[INFO] Posted channel notification for event ${event.id}`);
                        }
                    }
                } catch (channelError) {
                    console.error(`[ERROR] Failed to post channel notification for event ${event.id}:`, channelError.message);
                    // Continue even if channel notification fails
                }
            }

            // Mark event as notified
            await pool.query(
                'UPDATE events SET notifications_sent = TRUE WHERE id = ?',
                [event.id]
            );

            console.log(`[INFO] Marked event ${event.id} as notified`);
        }
    } catch (error) {
        console.error('[ERROR] Error in event notification checker:', error);
    }
}

// Start the notification checker
function startEventNotifier(client) {
    console.log('[INFO] Event notifier started');

    // Check every 30 seconds
    setInterval(() => {
        checkAndNotifyEvents(client);
    }, 30000); // 30 seconds

    // Also run immediately on start
    checkAndNotifyEvents(client);
}

module.exports = { startEventNotifier };
