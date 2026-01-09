const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors
} = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // ===== BOTÕES =====
    if (interaction.isButton()) {
      const [prefix, action, userId] = interaction.customId.split('_');
      if (prefix !== 'adminAction') return;

      const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setDescription('<:eg_cross:1353597108640415754> Você precisa ser um **administrador** para usar esta função.')
          ],
          ephemeral: true
        });
      }

      if (!targetMember) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setDescription('<:eg_cross:1353597108640415754> Usuário não encontrado no servidor.')
          ],
          ephemeral: true
        });
      }

      // Modal de castigo
      if (action === 'castigo') {
        const modal = new ModalBuilder()
          .setCustomId(`adminAction_modal_castigo_${userId}`)
          .setTitle('Aplicar Castigo')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('tempo')
                .setLabel('Tempo de castigo (ex: 10m, 1h, 2d)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
        return interaction.showModal(modal);
      }

      // Modal de expulsão ou banimento
      if (action === 'expulsao' || action === 'banimento') {
        const modal = new ModalBuilder()
          .setCustomId(`adminAction_modal_${action}_${userId}`)
          .setTitle(action === 'expulsao' ? 'Motivo da Expulsão' : 'Motivo do Banimento')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('motivo')
                .setLabel('Digite o motivo')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            )
          );
        return interaction.showModal(modal);
      }
    }

    // ===== MODAIS =====
    if (interaction.isModalSubmit()) {
      const [prefix, tipo, acao, userId] = interaction.customId.split('_');
      if (prefix !== 'adminAction') return;

      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setDescription('<:eg_cross:1353597108640415754> Apenas administradores podem realizar essa ação.')
          ],
          ephemeral: true
        });
      }

      if (!member) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setDescription('<:eg_cross:1353597108640415754> Usuário não encontrado.')
          ],
          ephemeral: true
        });
      }

      // === Castigo ===
      if (acao === 'castigo') {
        const tempoTexto = interaction.fields.getTextInputValue('tempo');
        const match = tempoTexto.match(/^(\d+)([smhd])$/);

        if (!match) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('Yellow')
                .setDescription('<:eg_excl:1353597115196244031> **Formato inválido!** Use `10m`, `1h`, `2d`, etc.')
            ],
            ephemeral: true
          });
        }

        const tempo = parseInt(match[1]);
        const unidade = match[2];
        let ms = 0;

        switch (unidade) {
          case 's': ms = tempo * 1000; break;
          case 'm': ms = tempo * 60 * 1000; break;
          case 'h': ms = tempo * 60 * 60 * 1000; break;
          case 'd': ms = tempo * 24 * 60 * 60 * 1000; break;
        }

        try {
          await member.timeout(ms, `Castigo aplicado por ${interaction.user.tag}`);
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('<:icons_timeout:1353597403986526270> Castigo Aplicado')
                .setDescription(`**${member.user.tag}** foi castigado por \`${tempoTexto}\`.`)
                .setColor(Colors.Orange)
            ],
            ephemeral: true
          });
        } catch (err) {
          console.error('Erro ao aplicar castigo:', err);
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> Erro ao aplicar o castigo. Verifique as permissões do bot.')
            ],
            ephemeral: true
          });
        }
      }

      // === Expulsão ===
      if (acao === 'expulsao') {
        const motivo = interaction.fields.getTextInputValue('motivo');

        try {
          await member.kick(motivo);
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('<:icons_kick:1353597294854930432> Usuário Expulso')
                .setDescription(`**${member.user.tag}** foi expulso.\n**Motivo:** ${motivo}`)
                .setColor(Colors.Red)
            ],
            ephemeral: true
          });
        } catch (err) {
          console.error('Erro ao expulsar:', err);
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> Não foi possível expulsar o usuário.')
            ],
            ephemeral: true
          });
        }
      }

      // === Banimento ===
      if (acao === 'banimento') {
        const motivo = interaction.fields.getTextInputValue('motivo');

        try {
          await member.ban({ reason: motivo });
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('<:icons_ban:1353597206992523380> Usuário Banido')
                .setDescription(`**${member.user.tag}** foi banido permanentemente.\n**Motivo:** ${motivo}`)
                .setColor(Colors.DarkRed)
            ],
            ephemeral: true
          });
        } catch (err) {
          console.error('Erro ao banir:', err);
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> Não foi possível banir o usuário.')
            ],
            ephemeral: true
          });
        }
      }
    }
  }
};