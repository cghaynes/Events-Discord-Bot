const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
        .addStringOption(option =>
            option.setName('host_type')
                .setDescription('Is the host a user or a group/role?')
                .setRequired(true)
                .addChoices(
                    { name: 'User', value: 'user' },
                    { name: 'Group/Role', value: 'group' }
                ))
        .addUserOption(option =>
            option.setName('host_user')
                .setDescription('The user hosting the event (if host type is User)')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('host_group')
                .setDescription('The role/group hosting the event (if host type is Group)')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('An image for the event')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Get all the options
            const eventName = interaction.options.getString('name');
            const dateTimeString = interaction.options.getString('datetime');
            const description = interaction.options.getString('description');
            const hostType = interaction.options.getString('host_type');
            const hostUser = interaction.options.getUser('host_user');
            const hostGroup = interaction.options.getRole('host_group');
            const imageAttachment = interaction.options.getAttachment('image');

            // Validate host selection
            let hostId, hostName;
            if (hostType === 'user') {
                if (!hostUser) {
                    return await interaction.editReply('Please select a host user when host type is "User".');
                }
                hostId = hostUser.id;
                hostName = hostUser.username;
            } else if (hostType === 'group') {
                if (!hostGroup) {
                    return await interaction.editReply('Please select a host group/role when host type is "Group".');
                }
                hostId = hostGroup.id;
                hostName = hostGroup.name;
            }

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
                (event_name, description, event_date, host_type, host_id, host_name, image_url, created_by, guild_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    eventName,
                    description,
                    eventDate,
                    hostType,
                    hostId,
                    hostName,
                    imageUrl,
                    interaction.user.id,
                    interaction.guildId
                ]
            );

            // Create a nice embed for confirmation
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Event Created Successfully!')
                .addFields(
                    { name: 'Event Name', value: eventName, inline: false },
                    { name: 'Description', value: description, inline: false },
                    { name: 'Date & Time (UTC)', value: `<t:${Math.floor(new Date(dateTimeString).getTime() / 1000)}:F>`, inline: false },
                    { name: 'Host Type', value: hostType === 'user' ? 'User' : 'Group/Role', inline: true },
                    { name: 'Host', value: hostType === 'user' ? `<@${hostId}>` : `<@&${hostId}>`, inline: true },
                    { name: 'Event ID', value: `#${result.insertId}`, inline: true }
                )
                .setFooter({ text: `Created by ${interaction.user.username}` })
                .setTimestamp();

            if (imageUrl) {
                embed.setImage(imageUrl);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error creating event:', error);
            await interaction.editReply('An error occurred while creating the event. Please make sure the database is set up correctly.');
        }
    },
};
