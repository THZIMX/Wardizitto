const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { query } = require('../../handlers/db.js');

module.exports = {
    async execute(interaction) {
        const { customId, guild, user, channel, member } = interaction;

        // --- INTERAÇÕES DE SELECT MENUS ---
        if (interaction.isChannelSelectMenu()) {
            if (customId === 'select_ticket_category') {
                const categoryId = interaction.values[0];
                await query('INSERT INTO tickets_config (guild_id, category_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE category_id = VALUES(category_id)', [guild.id, categoryId]);
                await interaction.reply({ content: '✅ Categoria configurada!', ephemeral: true });
                return this.refreshPanel(interaction);
            }

            if (customId === 'select_ticket_channels') {
                const [channel1, channel2] = interaction.values;
                // Vamos assumir que o usuário selecionou Logs e Painel (ordem não importa, mas vamos salvar)
                await query(
                    `INSERT INTO tickets_config (guild_id, logs_channel_id, panel_channel_id) 
                     VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE 
                     logs_channel_id = VALUES(logs_channel_id), panel_channel_id = VALUES(panel_channel_id)`,
                    [guild.id, channel1, channel2]
                );
                await interaction.reply({ content: '✅ Canais de Logs e Painel configurados!', ephemeral: true });
                return this.refreshPanel(interaction);
            }
        }

        if (interaction.isRoleSelectMenu()) {
            if (customId === 'select_ticket_role') {
                const roleId = interaction.values[0];
                await query('INSERT INTO tickets_config (guild_id, support_role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE support_role_id = VALUES(support_role_id)', [guild.id, roleId]);
                await interaction.reply({ content: '✅ Cargo de suporte configurado!', ephemeral: true });
                return this.refreshPanel(interaction);
            }
        }

        // --- INTERAÇÕES DE BOTÕES ---
        if (interaction.isButton()) {
            // Abrir Ticket
            if (customId === 'open_ticket') {
                await interaction.deferReply({ ephemeral: true });
                const config = (await query('SELECT * FROM tickets_config WHERE guild_id = ?', [guild.id]))[0];
                if (!config) return interaction.editReply('❌ O sistema não está configurado.');

                const existingTicket = (await query('SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = "open"', [guild.id, user.id]))[0];
                if (existingTicket) return interaction.editReply(`❌ Você já possui um ticket aberto: <#${existingTicket.channel_id}>`);

                try {
                    const ticketChannel = await guild.channels.create({
                        name: `ticket-${user.username}`,
                        type: ChannelType.GuildText,
                        parent: config.category_id || null,
                        permissionOverwrites: [
                            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                            { id: config.support_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                        ],
                    });

                    await query('INSERT INTO tickets (guild_id, channel_id, user_id) VALUES (?, ?, ?)', [guild.id, ticketChannel.id, user.id]);

                    const embed = new EmbedBuilder()
                        .setTitle(config.embed_title || '🎫 Ticket Aberto')
                        .setDescription(config.ticket_message || `Olá ${user}, descreva seu problema detalhadamente.`)
                        .setColor(config.embed_color || '#2f3136')
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Assumir').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Success),
                    );

                    await ticketChannel.send({ content: `<@&${config.support_role_id}> | ${user}`, embeds: [embed], components: [row] });

                    if (config.logs_channel_id) {
                        const logsChannel = await guild.channels.fetch(config.logs_channel_id).catch(() => null);
                        if (logsChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setTitle('🎫 Novo Ticket')
                                .addFields({ name: 'Usuário', value: `${user}`, inline: true }, { name: 'Canal', value: `${ticketChannel}`, inline: true })
                                .setColor('#00ff00').setTimestamp();
                            await logsChannel.send({ embeds: [logEmbed] });
                        }
                    }
                    return interaction.editReply(`✅ Ticket criado: ${ticketChannel}`);
                } catch (err) {
                    return interaction.editReply('❌ Erro ao criar canal.');
                }
            }

            // Fechar Ticket
            if (customId === 'close_ticket') {
                await interaction.deferUpdate();
                const ticket = (await query('SELECT * FROM tickets WHERE channel_id = ? AND status = "open"', [channel.id]))[0];
                if (!ticket) return;

                const config = (await query('SELECT * FROM tickets_config WHERE guild_id = ?', [guild.id]))[0];
                await query('UPDATE tickets SET status = "closed", closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?', [user.id, channel.id]);

                if (config.logs_channel_id) {
                    const logsChannel = await guild.channels.fetch(config.logs_channel_id).catch(() => null);
                    if (logsChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('🔒 Ticket Fechado')
                            .addFields({ name: 'Usuário', value: `<@${ticket.user_id}>`, inline: true }, { name: 'Fechado por', value: `${user}`, inline: true })
                            .setColor('#ff0000').setTimestamp();
                        await logsChannel.send({ embeds: [logEmbed] });
                    }
                }
                await channel.send('🔒 Ticket fechado. Deletando em 5s...');
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }

            // Assumir Ticket
            if (customId === 'claim_ticket') {
                const config = (await query('SELECT * FROM tickets_config WHERE guild_id = ?', [guild.id]))[0];
                if (!member.roles.cache.has(config.support_role_id) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
                }
                await interaction.reply({ content: `🙋‍♂️ Assumido por ${user}.` });
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Assumido').setStyle(ButtonStyle.Secondary).setDisabled(true),
                );
                await interaction.message.edit({ components: [row] });
            }

            // Personalizar Aparência (Modal)
            if (customId === 'config_ticket_appearance') {
                const modal = new ModalBuilder().setCustomId('modal_ticket_appearance').setTitle('Aparência do Ticket');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_title').setLabel('Título do Painel').setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_description').setLabel('Descrição do Painel').setStyle(TextInputStyle.Paragraph).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_color').setLabel('Cor Hex (ex: #ff0000)').setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_message').setLabel('Mensagem dentro do Ticket').setStyle(TextInputStyle.Paragraph).setRequired(false))
                );
                await interaction.showModal(modal);
            }

            // Enviar Painel
            if (customId === 'send_ticket_panel') {
                const config = (await query('SELECT * FROM tickets_config WHERE guild_id = ?', [guild.id]))[0];
                const panelChannel = await guild.channels.fetch(config.panel_channel_id).catch(() => null);
                if (!panelChannel) return interaction.reply({ content: '❌ Canal do painel não encontrado.', ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle(config.embed_title || '🎫 Central de Suporte')
                    .setDescription(config.embed_description || 'Clique no botão abaixo para abrir um ticket.')
                    .setColor(config.embed_color || '#2f3136');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('open_ticket').setLabel('Abrir Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
                );

                await panelChannel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: '✅ Painel enviado com sucesso!', ephemeral: true });
            }
        }

        // --- INTERAÇÕES DE MODAIS ---
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_ticket_appearance') {
                const embed_title = interaction.fields.getTextInputValue('embed_title');
                const embed_description = interaction.fields.getTextInputValue('embed_description');
                const embed_color = interaction.fields.getTextInputValue('embed_color');
                const ticket_message = interaction.fields.getTextInputValue('ticket_message');

                await query(
                    `UPDATE tickets_config SET embed_title = ?, embed_description = ?, embed_color = ?, ticket_message = ? WHERE guild_id = ?`,
                    [embed_title, embed_description, embed_color, ticket_message, guild.id]
                );
                await interaction.reply({ content: '✅ Configurações de aparência salvas!', ephemeral: true });
                return this.refreshPanel(interaction);
            }
        }
    },

    async refreshPanel(interaction) {
        const setupCommand = interaction.client.commands.get('setup-tickets');
        if (setupCommand && setupCommand.sendConfigPanel) {
            await setupCommand.sendConfigPanel(interaction);
        }
    }
};