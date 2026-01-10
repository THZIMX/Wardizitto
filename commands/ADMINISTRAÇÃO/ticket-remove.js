const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { query } = require('../../handlers/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-remove')
        .setDescription('Remove um membro do ticket atual.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('O usuário a ser removido.')
                .setRequired(true)),

    async execute(interaction) {
        const userToRemove = interaction.options.getUser('usuario');
        const { channel, guild, member } = interaction;

        // Verificar se é um canal de ticket
        const ticket = (await query('SELECT * FROM tickets WHERE channel_id = ? AND status = "open"', [channel.id]))[0];
        if (!ticket) {
            return interaction.reply({ content: '❌ Este comando só pode ser usado em canais de ticket ativos.', ephemeral: true });
        }

        const config = (await query('SELECT * FROM tickets_config WHERE guild_id = ?', [guild.id]))[0];
        if (!member.roles.cache.has(config.support_role_id) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Você não tem permissão para remover membros deste ticket.', ephemeral: true });
        }

        if (userToRemove.id === ticket.user_id) {
            return interaction.reply({ content: '❌ Você não pode remover o dono do ticket.', ephemeral: true });
        }

        await channel.permissionOverwrites.delete(userToRemove.id);

        return interaction.reply({ content: `✅ ${userToRemove} foi removido do ticket.` });
    }
};
