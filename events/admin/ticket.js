const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const discordTranscripts = require('discord-html-transcripts');
const { query } = require('../../handlers/db');

// IDs dos botões
const TICKET_BUTTONS = {
  OPEN: 'abrir_ticket',
  REASON_MODAL: 'ticket_reason_modal',
  CLOSE: 'fechar_ticket',
  ARCHIVE: 'arquivar_ticket',
  LOCK: 'trancar_ticket'
};

// Carrega emojis
const emojisData = require('../../databases/emojis.json');
const staticEmojis = emojisData.static || {};
const animatedEmojis = emojisData.animated || {};

function getEmoji(key) {
  if (staticEmojis[key]) return `<:${key}:${staticEmojis[key]}>`;
  if (animatedEmojis[key]) return `<a:${key}:${animatedEmojis[key]}>`;
  return '❓';
}

function getEmojiObject(emojiString) {
  if (!emojiString) return { name: '🔒' };
  const match = emojiString.match(/<?a?:?(\w+):(\d+)>/);
  return match ? { id: match[2] } : { name: '🔒' };
}

const EMOJIS = {
  TICKET: getEmoji('🏷'),
  SUCCESS: getEmoji('icons_correct'),
  ERROR: getEmoji('icons_wrong'),
  WARNING: getEmoji('eg_cautions'),
  CLOSE: getEmoji('icons_delete'),
  LOG: getEmoji('icons_text1'),
  STAFF: getEmoji('eg_modadmin'),
  TIME: getEmoji('eg_hourclock'),
  USER: getEmoji('icons_person'),
  CALENDAR: getEmoji('icons_calendar1'),
  LOCK: getEmoji('icons_lock'),
  ARCHIVE: getEmoji('icons_archive'),
  QUESTION: getEmoji('icons_question'),
  FOLDER: getEmoji('icons_folder'),
  SETTINGS: getEmoji('eg_setting'),
  ARROW: getEmoji('eg_downarrow'),
  WRENCH: getEmoji('eg_wrench')
};

function createTicketEmbed({ title, description, color, fields = [], footer, timestamp = true }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || null) // Usa null se description for undefined
    .setColor(color)
    .addFields(fields);
  if (footer) embed.setFooter(footer);
  if (timestamp) embed.setTimestamp();
  return embed;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;
    if (!Object.values(TICKET_BUTTONS).includes(interaction.customId)) return;

    const guildId = interaction.guild.id;

    try {
      // Verificar permissões do bot
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels | PermissionsBitField.Flags.SendMessages)) {
        return interaction.reply({
          content: `${EMOJIS.ERROR} Não tenho permissões para gerenciar canais ou enviar mensagens!`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Buscar configuração do ticket
      const configRows = await query('SELECT * FROM ticket_config WHERE guild_id = ?', [guildId]);
      if (!configRows.length || !configRows[0].active) {
        return interaction.reply({
          content: `${EMOJIS.WARNING} O sistema de tickets não está configurado ou está desativado!`,
          flags: MessageFlags.Ephemeral
        });
      }
      const config = configRows[0];

      // Cache de canais e cargos
      const categoria = interaction.guild.channels.cache.get(config.category_id);
      const cargo = interaction.guild.roles.cache.get(config.staff_role_id);
      const logs = interaction.guild.channels.cache.get(config.log_channel_id);
      if (!categoria || !cargo || !logs) {
        return interaction.reply({
          content: `${EMOJIS.ERROR} Configuração inválida! Verifique a categoria, cargo ou canal de logs.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Abrir Ticket
      if (interaction.customId === TICKET_BUTTONS.OPEN) {
        console.log(`[TICKET] Botão abrir_ticket clicado por ${interaction.user.tag}`);
        if (typeof config.ticket_limit !== 'number' || config.ticket_limit < 0) {
          return interaction.reply({
            content: `${EMOJIS.ERROR} Limite de tickets inválido na configuração!`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (config.ticket_limit > 0) {
          try {
            const userTickets = await query(
              'SELECT * FROM user_tickets WHERE user_id = ? AND status = "open"',
              [interaction.user.id]
            );
            console.log(`[TICKET] Tickets abertos encontrados: ${userTickets.length}`);
            if (userTickets.length >= config.ticket_limit) {
              return interaction.reply({
                content: `${EMOJIS.WARNING} Você já tem ${userTickets.length} tickets abertos! O limite é ${config.ticket_limit}.`,
                flags: MessageFlags.Ephemeral
              });
            }
          } catch (error) {
            console.error('[TICKET] Erro ao verificar tickets abertos:', error);
            return interaction.reply({
              content: `${EMOJIS.ERROR} Erro ao verificar tickets abertos. Tente novamente.`,
              flags: MessageFlags.Ephemeral
            });
          }
        }

        const modal = new ModalBuilder()
          .setCustomId(TICKET_BUTTONS.REASON_MODAL)
          .setTitle('🏷 Criar Ticket')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('ticket_reason')
                .setLabel('Motivo do ticket')
                .setPlaceholder('Descreva o motivo para abrir este ticket')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(500)
            )
          );

        console.log('[TICKET] Exibindo modal de motivo');
        return await interaction.showModal(modal);
      }

      // Processar Modal de Motivo
      if (interaction.customId === TICKET_BUTTONS.REASON_MODAL) {
        console.log(`[TICKET] Modal ${TICKET_BUTTONS.REASON_MODAL} enviado por ${interaction.user.tag}`);
        await interaction.deferReply({ ephemeral: true });

        const reason = sanitizeHtml(interaction.fields.getTextInputValue('ticket_reason'), {
          allowedTags: [],
          allowedAttributes: {}
        });

        try {
          const ticketId = uuidv4().substring(0, 6);
          const ticketChannel = await interaction.guild.channels.create({
            name: `${config.channel_prefix}-${interaction.user.username}-${ticketId}`,
            type: 0,
            parent: categoria.id,
            permissionOverwrites: [
              { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
              {
                id: interaction.user.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.AttachFiles,
                  PermissionsBitField.Flags.EmbedLinks,
                  PermissionsBitField.Flags.ReadMessageHistory
                ]
              },
              {
                id: cargo.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ManageMessages,
                  PermissionsBitField.Flags.ManageChannels,
                  PermissionsBitField.Flags.ReadMessageHistory
                ]
              }
            ]
          });

          const ticketValues = [
            ticketChannel.id,
            interaction.user.id,
            interaction.user.tag,
            reason,
            Date.now(),
            'open',
            guildId
          ];
          await query(
            'INSERT INTO tickets (id, user_id, user_tag, reason, opened_at, status, guild_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ticketValues
          );
          await query(
            'INSERT INTO user_tickets (user_id, ticket_id, status, opened_at) VALUES (?, ?, ?, ?)',
            [interaction.user.id, ticketChannel.id, 'open', Date.now()]
          );

          const embed = createTicketEmbed({
            title: `${EMOJIS.TICKET} Ticket de ${interaction.user.username}`,
            description: [
              `**Motivo:** ${reason}\n`,
              config.open_message || `Olá ${interaction.user}, bem-vindo ao seu ticket!`,
              `${EMOJIS.ARROW} Nossa equipe responderá em breve`,
              `${EMOJIS.ARROW} Mantenha o assunto organizado`,
              `${EMOJIS.ARROW} Evite mensagens desnecessárias\n\n`,
              `${EMOJIS.WARNING} **Atenção:** Tickets falsos ou sem motivo serão punidos!`
            ].join('\n'),
            color: '#5865F2',
            fields: [
              { name: `${EMOJIS.USER} Usuário`, value: interaction.user.toString(), inline: true },
              { name: `${EMOJIS.CALENDAR} Criado em`, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
              { name: `${EMOJIS.STAFF} Atendimento`, value: `<@&${cargo.id}>`, inline: true }
            ],
            footer: { text: interaction.guild.name, iconURL: interaction.guild.iconURL() }
          });

          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(TICKET_BUTTONS.CLOSE)
                .setLabel('Fechar Ticket')
                .setEmoji(getEmojiObject(EMOJIS.CLOSE))
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(TICKET_BUTTONS.ARCHIVE)
                .setLabel('Arquivar')
                .setEmoji(getEmojiObject(EMOJIS.ARCHIVE))
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(TICKET_BUTTONS.LOCK)
                .setLabel('Trancar')
                .setEmoji(getEmojiObject(EMOJIS.LOCK))
                .setStyle(ButtonStyle.Primary)
            );

          await ticketChannel.send({
            content: `${interaction.user} ${EMOJIS.STAFF} <@&${cargo.id}>`,
            embeds: [embed],
            components: [row]
          });

          const logEmbed = createTicketEmbed({
            title: `${EMOJIS.TICKET} Novo Ticket Aberto`,
            description: `**ID:** ${ticketId}\n**Motivo:** ${reason}`,
            color: '#57F287',
            fields: [
              { name: `${EMOJIS.USER} Usuário`, value: interaction.user.tag, inline: true },
              { name: `${EMOJIS.CALENDAR} Criado em`, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
              { name: `${EMOJIS.LOG} Link`, value: `[Ir para ticket](${ticketChannel.url})`, inline: true }
            ],
            footer: { text: `ID: ${interaction.user.id}`, iconURL: interaction.user.displayAvatarURL() }
          });

          await logs.send({ embeds: [logEmbed] });
          return interaction.editReply({
            content: `${EMOJIS.SUCCESS} Seu ticket foi criado: ${ticketChannel}`,
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          console.error('[TICKET] Erro ao criar ticket:', error);
          return interaction.editReply({
            content: `${EMOJIS.ERROR} Erro ao criar o ticket. Tente novamente ou contate um administrador.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Fechar Ticket
      if (interaction.customId === TICKET_BUTTONS.CLOSE) {
        if (!interaction.member.roles.cache.has(config.staff_role_id)) {
          return interaction.reply({
            content: `${EMOJIS.WARNING} Você não tem permissão para fechar tickets!`,
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const ticketRows = await query('SELECT * FROM tickets WHERE id = ?', [interaction.channel.id]);
          if (!ticketRows.length) {
            return interaction.editReply({
              content: `${EMOJIS.ERROR} Ticket não encontrado no banco de dados!`,
              flags: MessageFlags.Ephemeral
            });
          }
          const ticketData = ticketRows[0];

          await query(
            'UPDATE tickets SET status = ?, closed_by = ?, closed_at = ? WHERE id = ?',
            ['closed', interaction.user.id, Date.now(), interaction.channel.id]
          );
          await query('UPDATE user_tickets SET status = ? WHERE ticket_id = ?', ['closed', interaction.channel.id]);

          let attachment;
          if (config.generate_transcript) {
            attachment = await discordTranscripts.createTranscript(interaction.channel, {
              limit: -1,
              returnType: 'attachment',
              filename: `transcript-${interaction.channel.name}.html`
            });
          }

          await query(
            'INSERT INTO ticket_history (ticket_id, user_id, user_tag, reason, opened_at, closed_at, closed_by, guild_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              interaction.channel.id,
              ticketData.user_id,
              ticketData.user_tag,
              ticketData.reason,
              ticketData.opened_at,
              Date.now(),
              interaction.user.id,
              guildId
            ]
          );

          const logEmbed = createTicketEmbed({
            title: `${EMOJIS.TICKET} Ticket Fechado - ${interaction.channel.name}`,
            description: null,
            color: '#ED4245',
            fields: [
              { name: `${EMOJIS.USER} Criado por`, value: `<@${ticketData.user_id}>`, inline: true },
              { name: `${EMOJIS.CALENDAR} Aberto em`, value: `<t:${Math.floor(ticketData.opened_at / 1000)}:R>`, inline: true },
              { name: `${EMOJIS.STAFF} Fechado por`, value: interaction.user.toString(), inline: true },
              {
                name: `${EMOJIS.TIME} Estatísticas`,
                value: `Mensagens: ${(await interaction.channel.messages.fetch()).size}\nParticipantes: ${interaction.channel.members.size}`
              },
              { name: `${EMOJIS.QUESTION} Motivo`, value: ticketData.reason || 'Não especificado' }
            ]
          });

          if (config.generate_transcript) {
            await logs.send({ embeds: [logEmbed], files: [attachment] });
          } else {
            await logs.send({ embeds: [logEmbed] });
          }

          const closeEmbed = createTicketEmbed({
            title: `${EMOJIS.TICKET} Ticket Fechado`,
            description: config.close_message || 'Este ticket foi fechado.',
            color: '#ED4245',
            fields: [
              { name: `${EMOJIS.STAFF} Fechado por`, value: interaction.user.toString(), inline: true },
              {
                name: `${EMOJIS.TIME} Duração`,
                value: `${Math.floor((Date.now() - ticketData.opened_at) / 3600000)} horas`,
                inline: true
              }
            ]
          });

          await interaction.channel.send({ content: `<@${ticketData.user_id}>`, embeds: [closeEmbed] });
          setTimeout(async () => {
            try {
              await interaction.channel.delete('Ticket fechado');
            } catch (err) {
              console.error('[TICKET] Erro ao deletar canal:', err);
            }
          }, 5000);

          return interaction.editReply({
            content: `${EMOJIS.SUCCESS} Ticket fechado com sucesso!${config.generate_transcript ? ' O transcript foi arquivado.' : ''}`,
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          console.error('[TICKET] Erro ao fechar ticket:', error);
          return interaction.editReply({
            content: `${EMOJIS.ERROR} Erro ao fechar o ticket. Tente novamente ou contate um administrador.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Trancar Ticket
      if (interaction.customId === TICKET_BUTTONS.LOCK) {
        if (!interaction.member.roles.cache.has(config.staff_role_id)) {
          return interaction.reply({
            content: `${EMOJIS.WARNING} Você não tem permissão para trancar tickets!`,
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          const ticketRows = await query('SELECT * FROM tickets WHERE id = ?', [interaction.channel.id]);
          if (!ticketRows.length) {
            return interaction.reply({
              content: `${EMOJIS.ERROR} Ticket não encontrado!`,
              flags: MessageFlags.Ephemeral
            });
          }
          const ticketData = ticketRows[0];

          await query(
            'UPDATE tickets SET status = ?, locked_by = ?, locked_at = ? WHERE id = ?',
            ['locked', interaction.user.id, Date.now(), interaction.channel.id]
          );
          await query('UPDATE user_tickets SET status = ? WHERE ticket_id = ?', ['locked', interaction.channel.id]);

          await interaction.channel.permissionOverwrites.edit(ticketData.user_id, {
            SendMessages: false,
            AddReactions: false
          });

          const lockEmbed = createTicketEmbed({
            title: `${EMOJIS.LOCK} Ticket Trancado`,
            description: `Este ticket foi trancado por ${interaction.user}. Apenas a equipe pode enviar mensagens.`,
            color: '#FEE75C'
          });

          await interaction.channel.send({ content: `<@${ticketData.user_id}>`, embeds: [lockEmbed] });

          const logEmbed = createTicketEmbed({
            title: `${EMOJIS.LOCK} Ticket Trancado`,
            description: `Ticket trancado por ${interaction.user}.`,
            color: '#FEE75C',
            fields: [
              { name: `${EMOJIS.USER} Usuário`, value: `<@${ticketData.user_id}>`, inline: true },
              { name: `${EMOJIS.STAFF} Trancado por`, value: interaction.user.toString(), inline: true },
              { name: `${EMOJIS.LOG} Link`, value: `[Ir para ticket](${interaction.channel.url})`, inline: true }
            ]
          });

          await logs.send({ embeds: [logEmbed] });
          return interaction.reply({
            content: `${EMOJIS.SUCCESS} Ticket trancado com sucesso!`,
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          console.error('[TICKET] Erro ao trancar ticket:', error);
          return interaction.reply({
            content: `${EMOJIS.ERROR} Erro ao trancar o ticket. Tente novamente ou contate um administrador.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Arquivar Ticket
      if (interaction.customId === TICKET_BUTTONS.ARCHIVE) {
        if (!interaction.member.roles.cache.has(config.staff_role_id)) {
          return interaction.reply({
            content: `${EMOJIS.WARNING} Você não tem permissão para arquivar tickets!`,
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          const ticketRows = await query('SELECT * FROM tickets WHERE id = ?', [interaction.channel.id]);
          if (!ticketRows.length) {
            return interaction.reply({
              content: `${EMOJIS.ERROR} Ticket não encontrado!`,
              flags: MessageFlags.Ephemeral
            });
          }
          const ticketData = ticketRows[0];

          await query(
            'UPDATE tickets SET status = ?, archived_by = ?, archived_at = ? WHERE id = ?',
            ['archived', interaction.user.id, Date.now(), interaction.channel.id]
          );
          await query('UPDATE user_tickets SET status = ? WHERE ticket_id = ?', ['archived', interaction.channel.id]);

          if (config.archive_category_id) {
            const archiveCategory = interaction.guild.channels.cache.get(config.archive_category_id);
            if (archiveCategory) {
              await interaction.channel.setParent(archiveCategory.id);
            }
          }

          const archiveEmbed = createTicketEmbed({
            title: `${EMOJIS.ARCHIVE} Ticket Arquivado`,
            description: `Este ticket foi arquivado por ${interaction.user}.`,
            color: '#99AAB5'
          });

          await interaction.channel.send({ content: `<@${ticketData.user_id}>`, embeds: [archiveEmbed] });

          const logEmbed = createTicketEmbed({
            title: `${EMOJIS.ARCHIVE} Ticket Arquivado`,
            description: `Ticket arquivado por ${interaction.user}.`,
            color: '#99AAB5',
            fields: [
              { name: `${EMOJIS.USER} Usuário`, value: `<@${ticketData.user_id}>`, inline: true },
              { name: `${EMOJIS.STAFF} Arquivado por`, value: interaction.user.toString(), inline: true },
              { name: `${EMOJIS.LOG} Link`, value: `[Ir para ticket](${interaction.channel.url})`, inline: true }
            ]
          });

          await logs.send({ embeds: [logEmbed] });
          return interaction.reply({
            content: `${EMOJIS.SUCCESS} Ticket arquivado com sucesso!`,
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          console.error('[TICKET] Erro ao arquivar ticket:', error);
          return interaction.reply({
            content: `${EMOJIS.ERROR} Erro ao arquivar o ticket. Tente novamente ou contate um administrador.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }
    } catch (error) {
      console.error('[TICKET] Erro geral no sistema de tickets:', error);
      const errorMessage = `${EMOJIS.ERROR} Ocorreu um erro inesperado. Tente novamente ou contate um administrador.`;
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    }
  }
};