const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  ChannelType,
  EmbedBuilder
} = require('discord.js');

const { static: emojis } = require('../../databases/emojis.json'); // Corrija conforme sua estrutura real

module.exports = {
  name: 'canalenv',

  async execute(interaction) {
    try {
      // ▼ SELECT MENU: Seleção de servidor
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'selecionar_servidor') {
          const selectedGuildId = interaction.values[0];
          const guild = interaction.client.guilds.cache.get(selectedGuildId);

          if (!guild) {
            return interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setColor('Red')
                  .setDescription(`<:icons_wrong:${emojis.icons_wrong}> **Servidor não encontrado.**`)
              ],
              components: [],
              ephemeral: true
            });
          }

          const canaisTexto = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildText && c.viewable)
            .map(c => ({ label: c.name, value: `${guild.id}-${c.id}` }))
            .slice(0, 25);

          if (canaisTexto.length === 0) {
            return interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setColor('Yellow')
                  .setDescription(`<:icons_warning:${emojis.icons_warning}> **Nenhum canal de texto disponível neste servidor.**`)
              ],
              components: [],
              ephemeral: true
            });
          }

          const canalSelect = new StringSelectMenuBuilder()
            .setCustomId('selecionar_canal_destino')
            .setPlaceholder('Selecione um canal...')
            .addOptions(canaisTexto);

          const row = new ActionRowBuilder().addComponents(canalSelect);

          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setColor('Blue')
                .setDescription(`<:icons_channel:${emojis.icons_channel}> Servidor selecionado: **${guild.name}**\nAgora escolha o canal:`)
            ],
            components: [row],
            ephemeral: true
          });
        }

        // ▼ SELECT MENU: Seleção de canal
        if (interaction.customId === 'selecionar_canal_destino') {
          const [guildId, channelId] = interaction.values[0].split('-');
          const guild = interaction.client.guilds.cache.get(guildId);
          const canal = guild?.channels.cache.get(channelId);

          if (!canal || !canal.viewable || canal.type !== ChannelType.GuildText) {
            return interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setColor('Red')
                  .setDescription(`<:icons_wrong:${emojis.icons_wrong}> **Canal inválido ou inacessível.**`)
              ],
              components: [],
              ephemeral: true
            });
          }

          const modal = new ModalBuilder()
            .setCustomId(`enviar_mensagem_modal-${guildId}-${channelId}`) // Usando hífens para melhor parse
            .setTitle('Mensagem Personalizada')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('mensagem_conteudo')
                  .setLabel('Escreva a mensagem que será enviada')
                  .setStyle(TextInputStyle.Paragraph)
                  .setMaxLength(2000)
                  .setRequired(true)
              )
            );

          return interaction.showModal(modal);
        }
      }

      // ▼ MODAL SUBMIT
      if (interaction.isModalSubmit() && interaction.customId.startsWith('enviar_mensagem_modal-')) {
        const [, guildId, channelId] = interaction.customId.split('-');
        const guild = interaction.client.guilds.cache.get(guildId);
        const canal = guild?.channels.cache.get(channelId);

        if (!canal || !canal.viewable || canal.type !== ChannelType.GuildText) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('Red')
                .setDescription(`<:icons_wrong:${emojis.icons_wrong}> **Não foi possível encontrar o canal selecionado.**`)
            ],
            ephemeral: true
          });
        }

        const conteudo = interaction.fields.getTextInputValue('mensagem_conteudo');

        await canal.send({ content: conteudo });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('Green')
              .setDescription(`<:icons_correct:${emojis.icons_correct}> **Mensagem enviada com sucesso em**\n**${guild.name}** → **#${canal.name}**.`)
          ],
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Erro no canalenv.js:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor('Red')
        .setDescription(`<:icons_wrong:${emojis.icons_wrong}> **Ocorreu um erro inesperado.**`);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
};