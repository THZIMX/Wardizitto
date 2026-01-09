const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const emojis = require('../../databases/emojis.json');
const emojiLeft = `<:icons_leftarrow:${emojis.static.icons_leftarrow}>`;
const emojiRight = `<:icons_rightarrow:${emojis.static.icons_rightarrow}>`;
const emojiLeave = `<:icons_leave:${emojis.static.icons_leave}>`;

module.exports = {
  name: 'sair',
  async execute(interaction) {
    const donoId = '1033922089436053535';
    if (!['proxima_pagina', 'anterior_pagina', 'sair_servidor_select'].includes(interaction.customId)) return;

    if (interaction.user.id !== donoId) {
      return interaction.reply({ content: 'Sem permissão.', ephemeral: true });
    }

    const state = interaction.client._sairServidor?.[interaction.user.id];
    if (!state) return;

    let { page, guilds } = state;
    const perPage = 25;

    if (interaction.isButton()) {
      if (interaction.customId === 'proxima_pagina') page++;
      else if (interaction.customId === 'anterior_pagina') page--;

      state.page = page;

      const slice = guilds.slice(page * perPage, (page + 1) * perPage);
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('sair_servidor_select')
        .setPlaceholder('Selecione o servidor')
        .addOptions(slice);

      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('anterior_pagina')
          .setLabel('Anterior')
          .setEmoji(emojiLeft)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('proxima_pagina')
          .setLabel('Próxima')
          .setEmoji(emojiRight)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((page + 1) * perPage >= guilds.length)
      );

      return interaction.update({
        content: `${emojiLeave} **Selecione o servidor que o bot vai sair:**`,
        components: [rowSelect, rowButtons]
      });
    }

    if (interaction.isStringSelectMenu()) {
      const guildId = interaction.values[0];
      const guild = interaction.client.guilds.cache.get(guildId);

      if (!guild) {
        return interaction.update({ content: 'Servidor não encontrado.', components: [] });
      }

      try {
        await guild.leave();
        return interaction.update({
          content: `Saí com sucesso de **${guild.name}** ${emojiLeave}`,
          components: []
        });
      } catch (err) {
        console.error(err);
        return interaction.update({
          content: 'Erro ao tentar sair do servidor.',
          components: []
        });
      }
    }
  }
};