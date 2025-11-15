const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pool } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editevent')
        .setDescription('Edit an existing event')
        .addIntegerOption(option =>
            option.setName('event_id')
                .setDescription('The ID of the event to edit')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('New event name')
                .setRequired(false)
                .setMaxLength(255))
        .addStringOption(option =>
            option.setName('datetime')
                .setDescription('New event date and time in UTC (format: YYYY-MM-DD HH:MM or ISO 8601)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('New event description')
                .setRequired(false)
                .setMaxLength(2000))
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('New event image')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('remove_image')
                .setDescription('Remove the current event image')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const eventId = interaction.options.getInteger('event_id');
            const newName = interaction.options.getString('name');
            const newDateTime = interaction.options.getString('datetime');
            const newDescription = interaction.options.getString('description');
            const newImage = interaction.options.getAttachment('image');
            const removeImage = interaction.options.getBoolean('remove_image');

            // Check if at least one field is being edited
            if (!newName && !newDateTime && !newDescription && !newImage && !removeImage) {
                return await interaction.editReply({
                    content: '❌ Please specify at least one field to edit (name, datetime, description, image, or remove_image).'
                });
            }

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

            // Check permissions
            const hasPermission =
                event.created_by === interaction.user.id ||
                interaction.member.permissions.has(PermissionFlagsBits.ManageEvents) ||
                interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasPermission) {
                return await interaction.editReply({
                    content: '❌ You don\'t have permission to edit this event. Only the event creator or users with "Manage Events" permission can edit events.'
                });
            }

            // Prepare update values
            let eventName = event.event_name;
            let eventDescription = event.description;
            let eventDate = event.event_date;
            let imageUrl = event.image_url;

            const changes = [];

            // Handle name change
            if (newName) {
                changes.push(`**Name**: ${event.event_name} → ${newName}`);
                eventName = newName;
            }

            // Handle description change
            if (newDescription) {
                changes.push(`**Description**: Updated`);
                eventDescription = newDescription;
            }

            // Handle date/time change
            if (newDateTime) {
                try {
                    const isoDate = new Date(newDateTime);
                    if (isNaN(isoDate.getTime())) {
                        throw new Error('Invalid date');
                    }
                    const oldTimestamp = Math.floor(new Date(event.event_date).getTime() / 1000);
                    const newTimestamp = Math.floor(isoDate.getTime() / 1000);
                    changes.push(`**Date & Time**: <t:${oldTimestamp}:F> → <t:${newTimestamp}:F>`);
                    eventDate = isoDate.toISOString().slice(0, 19).replace('T', ' ');
                } catch (error) {
                    return await interaction.editReply(
                        'Invalid date/time format. Please use one of these formats:\n' +
                        '- `YYYY-MM-DD HH:MM` (e.g., 2024-12-25 18:30)\n' +
                        '- ISO 8601 format (e.g., 2024-12-25T18:30:00Z)'
                    );
                }
            }

            // Handle image change
            if (newImage) {
                const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
                if (!validImageTypes.includes(newImage.contentType)) {
                    return await interaction.editReply('Please provide a valid image file (PNG, JPEG, GIF, or WebP).');
                }
                changes.push(`**Image**: Updated`);
                imageUrl = newImage.url;
            } else if (removeImage) {
                changes.push(`**Image**: Removed`);
                imageUrl = null;
            }

            // Update the database
            await pool.query(
                `UPDATE events
                SET event_name = ?, description = ?, event_date = ?, image_url = ?
                WHERE id = ?`,
                [eventName, eventDescription, eventDate, imageUrl, eventId]
            );

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

                    const timestamp = Math.floor(new Date(eventDate).getTime() / 1000);
                    const updateEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle(`📝 Event Updated: ${eventName}`)
                        .setDescription(eventDescription)
                        .addFields(
                            {
                                name: '🕐 Date & Time',
                                value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`,
                                inline: false
                            },
                            {
                                name: '📋 Changes Made',
                                value: changes.join('\n'),
                                inline: false
                            },
                            {
                                name: 'ℹ️ Updated By',
                                value: `${interaction.user.username}`,
                                inline: true
                            },
                            {
                                name: '🆔 Event ID',
                                value: `#${event.id}`,
                                inline: true
                            }
                        )
                        .setFooter({ text: 'This event has been updated' })
                        .setTimestamp();

                    if (imageUrl) {
                        updateEmbed.setImage(imageUrl);
                    }

                    await user.send({
                        content: '⚠️ An event you\'re interested in has been updated.',
                        embeds: [updateEmbed]
                    });

                    notifiedCount++;
                    console.log(`[INFO] Sent update notice to user ${interest.user_id} for event ${event.id}`);
                } catch (dmError) {
                    console.error(`[ERROR] Failed to send update DM to user ${interest.user_id}:`, dmError.message);
                }
            }

            // Update the announcement message if it exists
            let announcementUpdated = false;
            if (event.announcement_channel_id && event.announcement_message_id) {
                try {
                    const channel = await interaction.guild.channels.fetch(event.announcement_channel_id);
                    if (channel && channel.isTextBased()) {
                        const message = await channel.messages.fetch(event.announcement_message_id);

                        // Get current interested count
                        const [countResult] = await pool.query(
                            'SELECT COUNT(*) as count FROM event_interests WHERE event_id = ?',
                            [eventId]
                        );
                        const interestedCount = countResult[0].count;

                        // Recreate the announcement embed
                        const timestamp = Math.floor(new Date(eventDate).getTime() / 1000);
                        const announcementEmbed = new EmbedBuilder()
                            .setColor(0x5865F2)
                            .setTitle(`📅 New Event: ${eventName}`)
                            .setDescription(eventDescription)
                            .addFields(
                                {
                                    name: '🕐 Date & Time',
                                    value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`,
                                    inline: false
                                },
                                {
                                    name: '👥 Interested',
                                    value: `${interestedCount} ${interestedCount === 1 ? 'person' : 'people'}`,
                                    inline: true
                                }
                            )
                            .setFooter({ text: `Event ID: #${event.id} • Created by ${interaction.guild.members.cache.get(event.created_by)?.user.username || 'Unknown'} • Last edited by ${interaction.user.username}` })
                            .setTimestamp();

                        if (imageUrl) {
                            announcementEmbed.setImage(imageUrl);
                        }

                        // Recreate the button
                        const interestedButton = new ButtonBuilder()
                            .setCustomId(`event_interested_${event.id}`)
                            .setLabel('Interested')
                            .setEmoji('⭐')
                            .setStyle(ButtonStyle.Primary);

                        const row = new ActionRowBuilder()
                            .addComponents(interestedButton);

                        await message.edit({
                            embeds: [announcementEmbed],
                            components: [row]
                        });

                        announcementUpdated = true;
                        console.log(`[INFO] Updated announcement message for event ${event.id}`);
                    }
                } catch (updateError) {
                    console.error(`[ERROR] Failed to update announcement message:`, updateError.message);
                }
            }

            // Build confirmation message
            const confirmationEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Event Updated Successfully')
                .addFields(
                    { name: 'Event Name', value: eventName, inline: false },
                    { name: 'Event ID', value: `#${event.id}`, inline: true },
                    { name: 'Users Notified', value: `${notifiedCount} ${notifiedCount === 1 ? 'person' : 'people'}`, inline: true }
                )
                .addFields({
                    name: '📋 Changes',
                    value: changes.join('\n'),
                    inline: false
                })
                .setTimestamp();

            if (announcementUpdated) {
                confirmationEmbed.addFields({
                    name: '📢 Announcement',
                    value: 'Original announcement has been updated',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [confirmationEmbed] });

            console.log(`[INFO] Event ${event.id} updated by ${interaction.user.username}`);

        } catch (error) {
            console.error('Error editing event:', error);
            await interaction.editReply({
                content: 'An error occurred while editing the event. Please try again later.'
            });
        }
    },
};
