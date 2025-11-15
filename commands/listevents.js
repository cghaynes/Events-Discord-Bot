const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { pool } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listevents')
        .setDescription('List all upcoming events')
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter events')
                .setRequired(false)
                .addChoices(
                    { name: 'Upcoming Only', value: 'upcoming' },
                    { name: 'All Events', value: 'all' }
                )),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const filter = interaction.options.getString('filter') || 'upcoming';

            // Build query based on filter
            let query = `
                SELECT id, event_name, description, event_date, image_url, created_by, created_at
                FROM events
                WHERE guild_id = ?
            `;

            const params = [interaction.guildId];

            if (filter === 'upcoming') {
                query += ' AND event_date >= NOW()';
            }

            query += ' ORDER BY event_date ASC LIMIT 10';

            const [events] = await pool.query(query, params);

            // Check if there are any events
            if (events.length === 0) {
                const noEventsEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📅 No Events Found')
                    .setDescription(filter === 'upcoming'
                        ? 'There are no upcoming events scheduled.\n\nUse `/addevent` to create a new event!'
                        : 'There are no events in the database.\n\nUse `/addevent` to create a new event!')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [noEventsEmbed] });
            }

            // Create the main embed
            const listEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(filter === 'upcoming' ? '📅 Upcoming Events' : '📅 All Events')
                .setDescription(`Found ${events.length} event${events.length !== 1 ? 's' : ''}${events.length === 10 ? ' (showing first 10)' : ''}`)
                .setTimestamp();

            // Add fields for each event
            for (const event of events) {
                const eventDate = new Date(event.event_date);
                const timestamp = Math.floor(eventDate.getTime() / 1000);
                const isPast = eventDate < new Date();

                const fieldValue = [
                    `📝 ${event.description}`,
                    `🕐 <t:${timestamp}:F> (<t:${timestamp}:R>)`,
                    `🆔 Event ID: #${event.id}`,
                    isPast ? '⚠️ *This event has passed*' : ''
                ].filter(line => line).join('\n');

                listEmbed.addFields({
                    name: `${isPast ? '~~' : ''}${event.event_name}${isPast ? '~~' : ''}`,
                    value: fieldValue,
                    inline: false
                });
            }

            listEmbed.setFooter({
                text: filter === 'upcoming'
                    ? 'Use /listevents filter:All to see all events including past ones'
                    : `Requested by ${interaction.user.username}`
            });

            await interaction.editReply({ embeds: [listEmbed] });

        } catch (error) {
            console.error('Error listing events:', error);
            await interaction.editReply('An error occurred while retrieving events. Please make sure the database is set up correctly.');
        }
    },
};
