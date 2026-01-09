const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChannelType 
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
    .setName('config-ticket')
    .setDescription('「Administração」Configura o sistema de tickets do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('categoria')
        .setDescription('📂 Categoria onde os tickets serão criados')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory))
    .addRoleOption(option =>
      option.setName('cargo-equipe')
        .setDescription('👮 Cargo da equipe que gerenciará os tickets')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('canal-logs')
        .setDescription('📜 Canal de registro das ações dos tickets')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addChannelOption(option =>
      option.setName('canal-painel')
        .setDescription('📌 Canal onde o painel de tickets será enviado (opcional)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(option =>
      option.setName('mensagem-abertura')
        .setDescription('💬 Mensagem enviada quando um ticket é aberto (opcional)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('mensagem-fechamento')
        .setDescription('🔒 Mensagem enviada quando um ticket é fechado (opcional)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('transcript')
        .setDescription('📄 Se deseja gerar transcript (histórico) ao fechar tickets')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('limite-tickets')
        .setDescription('🔢 Número máximo de tickets por usuário (0 = ilimitado)')
        .setRequired(false)
        .setMinValue(0))
    .addStringOption(option =>
      option.setName('prefixo-canais')
        .setDescription('🏷️ Prefixo para os nomes dos canais de ticket (opcional)')
        .setRequired(false)),

  async execute(interaction) {
    // Emojis
    const emojis = {
      success: "<:icons_correct:1353597185542979664>",
      folder: "<:icons_folder:1353597430951841865>",
      staff: "<:eg_modadmin:1353597141569769555>",
      log: "<:icons_text1:1353597395501449337>",
      settings: "<:eg_setting:1353597157134962780>",
      arrow: "<:eg_downarrow:1353597112608096338>",
      panel: "<:icons_list:1353597359873720340>",
      message: "<:icons_message:1353597374565257227>",
      limit: "<:icons_time:1353597418768179301>",
      prefix: "<:icons_tag:1353597456781471744>"
    };

    // Obter todas as opções
    const categoria = interaction.options.getChannel('categoria');
    const cargoEquipe = interaction.options.getRole('cargo-equipe');
    const canalLogs = interaction.options.getChannel('canal-logs');
    const canalPainel = interaction.options.getChannel('canal-painel');
    const mensagemAbertura = interaction.options.getString('mensagem-abertura') || "Obrigado por criar um ticket! A equipe logo irá atendê-lo.";
    const mensagemFechamento = interaction.options.getString('mensagem-fechamento') || "Este ticket foi fechado. Se precisar de mais ajuda, abra um novo ticket!";
    const gerarTranscript = interaction.options.getBoolean('transcript') ?? true;
    const limiteTickets = interaction.options.getInteger('limite-tickets') ?? 3;
    const prefixoCanais = interaction.options.getString('prefixo-canais') || "ticket";

    try {
      const connection = await pool.getConnection();
      
      // Criar tabela se não existir
      await connection.query(`
        CREATE TABLE IF NOT EXISTS ticket_config (
          guild_id VARCHAR(20) PRIMARY KEY,
          category_id VARCHAR(20) NOT NULL,
          staff_role_id VARCHAR(20) NOT NULL,
          log_channel_id VARCHAR(20) NOT NULL,
          panel_channel_id VARCHAR(20),
          open_message TEXT,
          close_message TEXT,
          generate_transcript BOOLEAN DEFAULT TRUE,
          ticket_limit INT DEFAULT 3,
          channel_prefix VARCHAR(50) DEFAULT 'ticket',
          configured_by VARCHAR(20) NOT NULL,
          configured_at BIGINT NOT NULL,
          active BOOLEAN DEFAULT TRUE
        )
      `);
      
      // Salvar/atualizar configurações
      await connection.query(`
        INSERT INTO ticket_config (
          guild_id, category_id, staff_role_id, log_channel_id, panel_channel_id,
          open_message, close_message, generate_transcript, ticket_limit, channel_prefix,
          configured_by, configured_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          category_id = VALUES(category_id),
          staff_role_id = VALUES(staff_role_id),
          log_channel_id = VALUES(log_channel_id),
          panel_channel_id = VALUES(panel_channel_id),
          open_message = VALUES(open_message),
          close_message = VALUES(close_message),
          generate_transcript = VALUES(generate_transcript),
          ticket_limit = VALUES(ticket_limit),
          channel_prefix = VALUES(channel_prefix),
          configured_by = VALUES(configured_by),
          configured_at = VALUES(configured_at),
          active = VALUES(active)
      `, [
        interaction.guild.id,
        categoria.id,
        cargoEquipe.id,
        canalLogs.id,
        canalPainel?.id || null,
        mensagemAbertura,
        mensagemFechamento,
        gerarTranscript,
        limiteTickets,
        prefixoCanais,
        interaction.user.id,
        Date.now()
      ]);
      
      connection.release();

      // Construir mensagem de resposta
      const response = [
        `${emojis.success} **Configuração do sistema de tickets salva!**`,
        `${emojis.folder} **Categoria:** ${categoria}`,
        `${emojis.staff} **Cargo da equipe:** ${cargoEquipe}`,
        `${emojis.log} **Canal de logs:** ${canalLogs}`,
        canalPainel ? `${emojis.panel} **Canal do painel:** ${canalPainel}` : "",
        `${emojis.message} **Mensagem de abertura:** \`${mensagemAbertura.substring(0, 30)}${mensagemAbertura.length > 30 ? '...' : ''}\``,
        `${emojis.message} **Mensagem de fechamento:** \`${mensagemFechamento.substring(0, 30)}${mensagemFechamento.length > 30 ? '...' : ''}\``,
        `${emojis.limit} **Limite de tickets:** ${limiteTickets === 0 ? 'Ilimitado' : limiteTickets}`,
        `${emojis.prefix} **Prefixo dos canais:** \`${prefixoCanais}\``,
        `\n${emojis.settings} Configuração realizada por: ${interaction.user}`
      ].filter(line => line !== "").join('\n');

      return interaction.reply({
        content: response,
        ephemeral: true
      });

    } catch (error) {
      console.error('Erro ao configurar tickets:', error);
      return interaction.reply({
        content: `${emojis.arrow} ❌ Ocorreu um erro ao salvar as configurações: ${error.message}`,
        ephemeral: true
      });
    }
  }
};