const {
  Events,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // Verificar se é um botão, modal ou select menu
    if (
      !interaction.isButton() &&
      !interaction.isModalSubmit() &&
      !interaction.isChannelSelectMenu()
    ) return;

    // Verificar permissões do usuário
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        content: '❌ Você não tem permissão para usar esta função.',
        ephemeral: true
      });
    }

    // Cancelar comunicado
    if (interaction.customId === 'cancelar_comunicado') {
      try {
        await interaction.message.delete();
        await interaction.reply({
          content: 'Comunicado cancelado com sucesso.',
          ephemeral: true
        });
      } catch (error) {
        await interaction.reply({
          content: 'Ocorreu um erro ao cancelar o comunicado.',
          ephemeral: true
        });
      }
      return;
    }

    // Editar comunicado - Abrir modal
    if (interaction.customId === 'editar_comunicado') {
      const originalEmbed = interaction.message.embeds[0];
      
      const modal = new ModalBuilder()
        .setCustomId('modal_editar_comunicado')
        .setTitle('Editar Comunicado');

      // Preencher campos com valores atuais
      const tituloInput = new TextInputBuilder()
        .setCustomId('titulo_comunicado')
        .setLabel('Título')
        .setStyle(TextInputStyle.Short)
        .setValue(originalEmbed.title?.replace('📢 ', '') || '')
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('mensagem_comunicado')
        .setLabel('Descrição')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(originalEmbed.description || '')
        .setRequired(true);

      const corInput = new TextInputBuilder()
        .setCustomId('cor_comunicado')
        .setLabel('Cor (hex ou nome básico)')
        .setStyle(TextInputStyle.Short)
        .setValue(originalEmbed.color ? `#${originalEmbed.color.toString(16).padStart(6, '0')}` : '#5865F2')
        .setRequired(false);

      const imgInput = new TextInputBuilder()
        .setCustomId('imagem_comunicado')
        .setLabel('URL da imagem (opcional)')
        .setStyle(TextInputStyle.Short)
        .setValue(originalEmbed.image?.url || '')
        .setRequired(false);

      const thumbInput = new TextInputBuilder()
        .setCustomId('thumb_comunicado')
        .setLabel('URL da thumbnail (opcional)')
        .setStyle(TextInputStyle.Short)
        .setValue(originalEmbed.thumbnail?.url || '')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(tituloInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(corInput),
        new ActionRowBuilder().addComponents(imgInput),
        new ActionRowBuilder().addComponents(thumbInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // Processar modal de edição
    if (interaction.customId === 'modal_editar_comunicado') {
      await interaction.deferUpdate();
      
      const titulo = interaction.fields.getTextInputValue('titulo_comunicado');
      const mensagem = interaction.fields.getTextInputValue('mensagem_comunicado');
      let cor = interaction.fields.getTextInputValue('cor_comunicado') || '#5865F2';
      
      // Padronizar cor
      cor = cor.startsWith('#') ? cor : `#${cor}`;

      const embed = new EmbedBuilder()
        .setTitle(`📢 ${titulo}`)
        .setDescription(mensagem)
        .setColor(cor)
        .setTimestamp()
        .setFooter({
          text: `Enviado por ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });

      // Adicionar imagem e thumbnail se fornecidas e válidas
      const imagem = interaction.fields.getTextInputValue('imagem_comunicado');
      const thumb = interaction.fields.getTextInputValue('thumb_comunicado');
      
      if (imagem && this.isValidURL(imagem)) embed.setImage(imagem);
      if (thumb && this.isValidURL(thumb)) embed.setThumbnail(thumb);

      // Recriar os botões de ação
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('editar_comunicado')
          .setLabel('✏️ Editar Embed')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('enviar_comunicado')
          .setLabel('📤 Enviar')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancelar_comunicado')
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // Enviar comunicado - Selecionar canal
    if (interaction.customId === 'enviar_comunicado') {
      const select = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('canal_destino_comunicado')
          .setPlaceholder('Selecione o canal para enviar')
          .setChannelTypes(0) // apenas canais de texto
      );

      await interaction.reply({
        content: '📍 Selecione o canal onde deseja enviar o comunicado:',
        components: [select],
        ephemeral: true
      });
      return;
    }

    // Processar seleção do canal
    if (interaction.customId === 'canal_destino_comunicado') {
      await interaction.deferUpdate();
      
      const canalId = interaction.values[0];
      
      // Buscar a mensagem original que contém o comunicado
      const originalMessage = await interaction.channel.messages.fetch(interaction.message.reference?.messageId);
      
      if (!originalMessage || !originalMessage.embeds[0]) {
        return await interaction.editReply({
          content: '❌ Não foi possível encontrar o comunicado para enviar.',
          components: [],
          embeds: []
        });
      }

      const embed = EmbedBuilder.from(originalMessage.embeds[0]);

      try {
        const canal = await interaction.guild.channels.fetch(canalId);
        
        // Verificar permissões do bot
        if (!canal.permissionsFor(interaction.client.user).has(PermissionsBitField.Flags.SendMessages)) {
          return await interaction.editReply({
            content: `❌ Não tenho permissão para enviar mensagens em ${canal.toString()}`,
            components: [],
            embeds: []
          });
        }

        // Enviar o comunicado
        await canal.send({ embeds: [embed] });

        // Atualizar a mensagem de seleção
        await interaction.editReply({
          content: `✅ Comunicado enviado com sucesso para ${canal.toString()}!`,
          components: [],
          embeds: []
        });
        
        // Deletar a mensagem original com os botões
        await originalMessage.delete().catch(() => {});
      } catch (error) {
        await interaction.editReply({
          content: '❌ Ocorreu um erro ao enviar o comunicado.',
          components: [],
          embeds: []
        });
      }
    }
  },

  // Função auxiliar para validar URLs
  isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }
};