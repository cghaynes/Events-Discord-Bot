const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pool } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addevent')
        .setDescription('Add a new event to the calendar')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the event')
                .setRequired(true)
                .setMaxLength(255))
        .addStringOption(option =>
            option.setName('datetime')
                .setDescription('Event date and time in UTC (format: YYYY-MM-DD HH:MM or ISO 8601)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the event')
                .setRequired(true)
                .setMaxLength(2000))
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('An image for the event')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get all the options
            const eventName = interaction.options.getString('name');
            const dateTimeString = interaction.options.getString('datetime');
            const description = interaction.options.getString('description');
            const imageAttachment = interaction.options.getAttachment('image');

            // Parse and validate date/time
            let eventDate;
            try {
                // Try to parse the date string
                // Support formats: YYYY-MM-DD HH:MM, ISO 8601
                const isoDate = new Date(dateTimeString);

                if (isNaN(isoDate.getTime())) {
                    throw new Error('Invalid date');
                }

                // Convert to MySQL datetime format
                eventDate = isoDate.toISOString().slice(0, 19).replace('T', ' ');
            } catch (error) {
                return await interaction.editReply(
                    'Invalid date/time format. Please use one of these formats:\n' +
                    '- `YYYY-MM-DD HH:MM` (e.g., 2024-12-25 18:30)\n' +
                    '- ISO 8601 format (e.g., 2024-12-25T18:30:00Z)'
                );
            }

            // Validate image if provided
            let imageUrl = null;
            if (imageAttachment) {
                // Check if it's an image
                const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
                if (!validImageTypes.includes(imageAttachment.contentType)) {
                    return await interaction.editReply('Please provide a valid image file (PNG, JPEG, GIF, or WebP).');
                }
                imageUrl = imageAttachment.url;
            }

            // Insert into database
            const [result] = await pool.query(
                `INSERT INTO events
                (event_name, description, event_date, image_url, created_by, guild_id)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    eventName,
                    description,
                    eventDate,
                    imageUrl,
                    interaction.user.id,
                    interaction.guildId
                ]
            );

            // Post announcement to channel if configured
            const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
            if (announcementChannelId && announcementChannelId !== 'your_channel_id_here') {
                try {
                    const announcementChannel = await interaction.guild.channels.fetch(announcementChannelId);

                    if (announcementChannel && announcementChannel.isTextBased()) {
                        // Get or create the Events Notifier role
                        const roleName = process.env.NOTIFIER_ROLE_NAME || 'Events Notifier';
                        let notifierRole = interaction.guild.roles.cache.find(r => r.name === roleName);

                        if (!notifierRole) {
                            try {
                                notifierRole = await interaction.guild.roles.create({
                                    name: roleName,
                                    color: 0x3498db,
                                    reason: 'Events Notifier role created for event announcements',
                                    mentionable: true
                                });
                                console.log(`[INFO] Created Events Notifier role for announcements`);
                            } catch (roleError) {
                                console.error('Error creating role for announcement:', roleError);
                            }
                        }

                        // Create announcement embed
                        const timestamp = Math.floor(new Date(dateTimeString).getTime() / 1000);
                        const announcementEmbed = new EmbedBuilder()
                            .setColor(0x5865F2)
                            .setTitle(`📅 New Event: ${eventName}`)
                            .setDescription(description)
                            .addFields(
                                {
                                    name: '🕐 Date & Time',
                                    value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`,
                                    inline: false
                                },
                                {
                                    name: '👥 Interested',
                                    value: '0 people',
                                    inline: true
                                }
                            )
                            .setFooter({ text: `Event ID: #${result.insertId} • Created by ${interaction.user.username}` })
                            .setTimestamp();

                        if (imageUrl) {
                            announcementEmbed.setImage(imageUrl);
                        }

                        // Create the Interested button
                        const interestedButton = new ButtonBuilder()
                            .setCustomId(`event_interested_${result.insertId}`)
                            .setLabel('Interested')
                            .setEmoji('⭐')
                            .setStyle(ButtonStyle.Primary);

                        const row = new ActionRowBuilder()
                            .addComponents(interestedButton);

                        // Send the announcement with role mention and button
                        const mentionText = notifierRole ? `${notifierRole} A new event has been scheduled!` : '📢 A new event has been scheduled!';

                        const announcementMessage = await announcementChannel.send({
                            content: mentionText,
                            embeds: [announcementEmbed],
                            components: [row]
                        });

                        // Update the database with the announcement message ID
                        await pool.query(
                            'UPDATE events SET announcement_message_id = ?, announcement_channel_id = ? WHERE id = ?',
                            [announcementMessage.id, announcementChannelId, result.insertId]
                        );

                        console.log(`[INFO] Posted event announcement to channel ${announcementChannelId}`);
                    }
                } catch (channelError) {
                    console.error('Error posting announcement:', channelError);
                    // Don't fail the command if announcement fails
                }
            }

            // Create a nice embed for confirmation
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Event Created Successfully!')
                .addFields(
                    { name: 'Event Name', value: eventName, inline: false },
                    { name: 'Description', value: description, inline: false },
                    { name: 'Date & Time (UTC)', value: `<t:${Math.floor(new Date(dateTimeString).getTime() / 1000)}:F>`, inline: false },
                    { name: 'Event ID', value: `#${result.insertId}`, inline: true }
                )
                .setFooter({ text: `Created by ${interaction.user.username}` })
                .setTimestamp();

            if (imageUrl) {
                embed.setImage(imageUrl);
            }

            if (announcementChannelId && announcementChannelId !== 'your_channel_id_here') {
                embed.addFields({
                    name: '📢 Announcement',
                    value: 'Event has been posted to the announcements channel!',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error creating event:', error);
            await interaction.editReply('An error occurred while creating the event. Please make sure the database is set up correctly.');
        }
    },
};
