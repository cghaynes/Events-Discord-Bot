const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notifyme')
        .setDescription('Manage your Events Notifier role subscription')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Add or remove the Events Notifier role')
                .setRequired(true)
                .addChoices(
                    { name: 'Subscribe (Add Role)', value: 'add' },
                    { name: 'Unsubscribe (Remove Role)', value: 'remove' }
                )),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const action = interaction.options.getString('action');
            const roleName = process.env.NOTIFIER_ROLE_NAME || 'Events Notifier';

            // Check if the bot has permission to manage roles
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return await interaction.editReply({
                    content: '❌ I don\'t have permission to manage roles. Please ask a server administrator to give me the "Manage Roles" permission.'
                });
            }

            // Try to find the role by name
            let role = interaction.guild.roles.cache.find(r => r.name === roleName);

            // If role doesn't exist, create it
            if (!role) {
                try {
                    role = await interaction.guild.roles.create({
                        name: roleName,
                        color: 0x3498db, // Blue color
                        reason: 'Events Notifier role created by bot',
                        mentionable: true
                    });
                    console.log(`[INFO] Created new role: ${roleName}`);
                } catch (error) {
                    console.error('Error creating role:', error);
                    return await interaction.editReply({
                        content: '❌ I couldn\'t create the Events Notifier role. Please check my permissions.'
                    });
                }
            }

            // Check if the bot's role is high enough to assign this role
            if (interaction.guild.members.me.roles.highest.position <= role.position) {
                return await interaction.editReply({
                    content: `❌ I can't manage the "${roleName}" role because it's higher than or equal to my highest role in the role hierarchy. Please ask an administrator to move my role above the "${roleName}" role.`
                });
            }

            const member = interaction.member;

            if (action === 'add') {
                // Check if user already has the role
                if (member.roles.cache.has(role.id)) {
                    return await interaction.editReply({
                        content: `ℹ️ You already have the ${role} role!`
                    });
                }

                // Add the role
                await member.roles.add(role);
                await interaction.editReply({
                    content: `✅ You've been subscribed to event notifications! You now have the ${role} role.\n\nYou will be notified about upcoming events. Use \`/notifyme action:Unsubscribe\` to opt out at any time.`
                });

            } else if (action === 'remove') {
                // Check if user has the role
                if (!member.roles.cache.has(role.id)) {
                    return await interaction.editReply({
                        content: `ℹ️ You don't have the ${role} role, so there's nothing to remove.`
                    });
                }

                // Remove the role
                await member.roles.remove(role);
                await interaction.editReply({
                    content: `✅ You've been unsubscribed from event notifications. The ${role} role has been removed.\n\nYou can re-subscribe at any time using \`/notifyme action:Subscribe\`.`
                });
            }

        } catch (error) {
            console.error('Error in notifyme command:', error);

            // Handle specific Discord API errors
            if (error.code === 50013) {
                await interaction.editReply({
                    content: '❌ I don\'t have sufficient permissions to manage roles. Please contact a server administrator.'
                });
            } else {
                await interaction.editReply({
                    content: '❌ An error occurred while managing your notification role. Please try again later or contact a server administrator.'
                });
            }
        }
    },
};
