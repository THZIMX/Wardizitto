const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DONO_ID = '1033922089436053535';

module.exports = {
  name: Events.report,

  async execute(interaction) {
    if (!interaction.isButton()) return;

    const { customId, user, message } = interaction;

    const isConfirmar = customId.startsWith('confirmar_bug_');
    const isResolver = customId.startsWith('resolver_bug_');

    if (!isConfirmar && !isResolver) return;

    // Apenas você pode usar
    if (user.id !== DONO_ID) {
      return interaction.reply({
        content: '❌ Apenas o desenvolvedor pode usar este botão.',
        ephemeral: true,
      });
    }

    const embed = EmbedBuilder.from(message.embeds[0]);

    // Tenta extrair o ID do usuário do embed
    const campoUsuario = embed.data.fields.find(f => f.name === '👤 Usuário');
    const matchUserId = campoUsuario?.value?.match(/`?(\d{17,20})`?/);
    const usuarioOriginalId = matchUserId?.[1];

    if (isConfirmar) {
      embed.setColor('Orange');
      const jaTemStatus = embed.data.fields.some(f => f.name === '🔍 Status');
      if (!jaTemStatus) {
        embed.addFields({ name: '🔍 Status', value: 'Bug confirmado como real.' });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`resolver_bug_${interaction.id}`)
          .setLabel('🛠️ Resolver Bug')
          .setStyle(ButtonStyle.Primary)
      );

      await message.edit({ embeds: [embed], components: [row] });

      return interaction.reply({
        content: '⚠️ Bug marcado como real. Agora você pode resolvê-lo.',
        ephemeral: true,
      });
    }

    if (isResolver) {
      embed.setColor('Green');
      embed.addFields({ name: '✅ Status', value: 'Bug resolvido.' });

      await message.edit({ embeds: [embed], components: [] });

      // 🔔 Envia DM de agradecimento
      if (usuarioOriginalId) {
        try {
          const userToNotify = await interaction.client.users.fetch(usuarioOriginalId);
          await userToNotify.send(
            '✅ Obrigado por reportar o bug! Ele foi resolvido com sucesso. Se encontrar mais problemas, estamos à disposição!'
          );
        } catch (err) {
          console.warn(`❌ Não foi possível enviar DM para o usuário ${usuarioOriginalId}. Provavelmente está com DMs fechadas.`);
        }
      }

      return interaction.reply({
        content: '🎉 Bug resolvido! E o usuário foi notificado (se possível).',
        ephemeral: true,
      });
    }
  }
};