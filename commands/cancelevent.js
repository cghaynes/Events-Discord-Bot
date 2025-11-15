const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cancelevent')
        .setDescription('Cancel an event and notify interested users')
        .addIntegerOption(option =>
            option.setName('event_id')
                .setDescription('The ID of the event to cancel')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const eventId = interaction.options.getInteger('event_id');

            // Get event details
            const [events] = await pool.query(
                'SELECT * FROM events WHERE id = ? AND guild_id = ?',
                [eventId, interaction.guildId]
            );

            if (events.length === 0) {
                return await interaction.editReply({
                    content: `❌ Event #${eventId} not found in this server.`
                });
            }

            const event = events[0];

            // Check permissions - only the creator or someone with Manage Events permission can cancel
            const hasPermission =
                event.created_by === interaction.user.id ||
                interaction.member.permissions.has(PermissionFlagsBits.ManageEvents) ||
                interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasPermission) {
                return await interaction.editReply({
                    content: '❌ You don\'t have permission to cancel this event. Only the event creator or users with "Manage Events" permission can cancel events.'
                });
            }

            // Get interested users
            const [interests] = await pool.query(
                'SELECT user_id FROM event_interests WHERE event_id = ?',
                [eventId]
            );

            // Send DMs to interested users
            let notifiedCount = 0;
            for (const interest of interests) {
                try {
                    const user = await interaction.client.users.fetch(interest.user_id);

                    const timestamp = Math.floor(new Date(event.event_date).getTime() / 1000);
                    const cancelEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle(`❌ Event Cancelled: ${event.event_name}`)
                        .setDescription(event.description)
                        .addFields(
                            {
                                name: '📅 Was Scheduled For',
                                value: `<t:${timestamp}:F>`,
                                inline: false
                            },
                            {
                                name: 'ℹ️ Cancelled By',
                                value: `${interaction.user.username}`,
                                inline: true
                            },
                            {
                                name: '🆔 Event ID',
                                value: `#${event.id}`,
                                inline: true
                            }
                        )
                        .setFooter({ text: 'This event has been cancelled' })
                        .setTimestamp();

                    if (event.image_url) {
                        cancelEmbed.setImage(event.image_url);
                    }

                    await user.send({
                        content: '⚠️ An event you were interested in has been cancelled.',
                        embeds: [cancelEmbed]
                    });

                    notifiedCount++;
                    console.log(`[INFO] Sent cancellation notice to user ${interest.user_id} for event ${event.id}`);
                } catch (dmError) {
                    console.error(`[ERROR] Failed to send cancellation DM to user ${interest.user_id}:`, dmError.message);
                    // Continue with other users even if one fails
                }
            }

            // Delete the announcement message if it exists
            let announcementDeleted = false;
            if (event.announcement_channel_id && event.announcement_message_id) {
                try {
                    const channel = await interaction.guild.channels.fetch(event.announcement_channel_id);
                    if (channel && channel.isTextBased()) {
                        const message = await channel.messages.fetch(event.announcement_message_id);
                        await message.delete();
                        announcementDeleted = true;
                        console.log(`[INFO] Deleted announcement message for event ${event.id}`);
                    }
                } catch (deleteError) {
                    console.error(`[ERROR] Failed to delete announcement message:`, deleteError.message);
                    // Continue even if deletion fails
                }
            }

            // Delete the event and all interests from database
            await pool.query('DELETE FROM event_interests WHERE event_id = ?', [eventId]);
            await pool.query('DELETE FROM events WHERE id = ?', [eventId]);

            // Build confirmation message
            const confirmationEmbed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('✅ Event Cancelled Successfully')
                .addFields(
                    { name: 'Event Name', value: event.event_name, inline: false },
                    { name: 'Event ID', value: `#${event.id}`, inline: true },
                    { name: 'Users Notified', value: `${notifiedCount} ${notifiedCount === 1 ? 'person' : 'people'}`, inline: true }
                )
                .setTimestamp();

            if (announcementDeleted) {
                confirmationEmbed.addFields({
                    name: '📢 Announcement',
                    value: 'Original announcement has been deleted',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [confirmationEmbed] });

            console.log(`[INFO] Event ${event.id} cancelled by ${interaction.user.username}`);

        } catch (error) {
            console.error('Error cancelling event:', error);
            await interaction.editReply({
                content: 'An error occurred while cancelling the event. Please try again later.'
            });
        }
    },
};
