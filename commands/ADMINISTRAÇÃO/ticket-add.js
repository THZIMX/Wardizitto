const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { query } = require('../../handlers/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-add')
        .setDescription('Adiciona um membro ao ticket atual.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('O usuário a ser adicionado.')
                .setRequired(true)),

    async execute(interaction) {
        const userToAdd = interaction.options.getUser('usuario');
        const { channel, guild, member } = interaction;

        // Verificar se é um canal de ticket
        const ticket = (await query('SELECT * FROM tickets WHERE channel_id = ? AND status = "open"', [channel.id]))[0];
        if (!ticket) {
            return interaction.reply({ content: '❌ Este comando só pode ser usado em canais de ticket ativos.', ephemeral: true });
        }

        const config = (await query('SELECT * FROM tickets_config WHERE guild_id = ?', [guild.id]))[0];
        if (!member.roles.cache.has(config.support_role_id) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Você não tem permissão para adicionar membros a este ticket.', ephemeral: true });
        }

        await channel.permissionOverwrites.edit(userToAdd.id, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
        });

        return interaction.reply({ content: `✅ ${userToAdd} foi adicionado ao ticket.` });
    }
};
