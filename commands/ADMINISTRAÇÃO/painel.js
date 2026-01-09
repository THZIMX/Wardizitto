const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  PermissionFlagsBits 
} = require('discord.js');
const mysql = require('mysql2/promise');
const config = require('../../config.json');

const pool = mysql.createPool({
  host: config.mariaDB.host,
  user: config.mariaDB.user,
  password: config.mariaDB.password,
  database: config.mariaDB.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enviar-ticket')
    .setDescription('「Administração」Envia o painel de tickets no canal atual')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('titulo')
        .setDescription('🔖 Título personalizado para o painel')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('📝 Descrição personalizada para o painel')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('cor')
        .setDescription('🎨 Cor do embed em hexadecimal (ex: #5865F2)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('botao')
        .setDescription('🖱️ Texto do botão (padrão: "Abrir Ticket")')
        .setRequired(false)),

  async execute(interaction) {
    // Emojis
    const emojis = {
      ticket: "<:eg_ticket:1353597167448621186>",
      success: "<:icons_correct:1353597185542979664>",
      error: "<:icons_Wrong:1353597220510437386>",
      arrow: "<:eg_downarrow:1353597112608096338>",
      wrench: "<:eg_wrench:1353597180748890183>",
      settings: "<:eg_setting:1353597157134962780>"
    };

    try {
      const connection = await pool.getConnection();
      
      // Buscar configuração do ticket
      const [configRows] = await connection.query(
        'SELECT * FROM ticket_config WHERE guild_id = ?',
        [interaction.guild.id]
      );
      
      connection.release();

      if (!configRows.length) {
        return interaction.reply({
          content: `${emojis.error} O sistema de tickets não foi configurado! Use \`/config-ticket\` primeiro.`,
          ephemeral: true
        });
      }

      const config = configRows[0];

      // Obter opções ou usar valores padrão
      const titulo = interaction.options.getString('titulo') || `${emojis.ticket} Sistema de Tickets`;
      const descricao = interaction.options.getString('descricao') || 
        `${emojis.arrow} **Clique no botão abaixo para criar um ticket**\n` +
        `${emojis.wrench} Nossa equipe responderá o mais rápido possível!`;
      const cor = interaction.options.getString('cor') || '#5865F2';
      const textoBotao = interaction.options.getString('botao') || 'Abrir Ticket';

      // Validar cor hexadecimal
      const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i;
      if (!hexColorRegex.test(cor)) {
        return interaction.reply({
          content: `${emojis.error} Cor inválida! Use um código hexadecimal como #5865F2.`,
          ephemeral: true
        });
      }

      // Criar embed do painel
      const embed = new EmbedBuilder()
        .setTitle(titulo)
        .setDescription(descricao)
        .setColor(cor)
        .setFooter({ 
          text: `${interaction.guild.name} • Painel de Tickets`, 
          iconURL: interaction.guild.iconURL() 
        })
        .setTimestamp();

      // Criar botão
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('abrir_ticket')
            .setLabel(textoBotao)
            .setEmoji(emojis.ticket)
            .setStyle(ButtonStyle.Primary)
        );

      // Enviar painel
      await interaction.channel.send({ 
        embeds: [embed], 
        components: [row] 
      });

      // Se um canal de painel não estava configurado, atualizar no banco
      if (!config.panel_channel_id) {
        const updateConnection = await pool.getConnection();
        await updateConnection.query(
          'UPDATE ticket_config SET panel_channel_id = ? WHERE guild_id = ?',
          [interaction.channel.id, interaction.guild.id]
        );
        updateConnection.release();
      }

      return interaction.reply({ 
        content: `${emojis.success} Painel de tickets enviado com sucesso!`, 
        ephemeral: true 
      });

    } catch (error) {
      console.error('Erro ao enviar painel de tickets:', error);
      return interaction.reply({
        content: `${emojis.error} Ocorreu um erro ao enviar o painel: ${error.message}`,
        ephemeral: true
      });
    }
  }
};