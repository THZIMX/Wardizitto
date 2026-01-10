async function initMySQL(pool) {
  try {
    console.log("🔄 Inicializando tabelas do MySQL...");

    // Tabela casamentos
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS casamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        parceiro_id VARCHAR(20) NOT NULL,
        data BIGINT NOT NULL,
        KEY idx_user (user_id),
        KEY idx_parceiro (parceiro_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'casamentos' criada/verificada com sucesso!");

    // Tabela generos
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS generos (
        user_id VARCHAR(20) PRIMARY KEY,
        genero ENUM('masculino', 'feminino') NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'gêneros' criada/verificada com sucesso!");

    // Tabela afk_status
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS afk_status (
        user_id VARCHAR(20) PRIMARY KEY,
        mensagem TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'afk_status' criada/verificada com sucesso!");

    // Tabela warns
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS warns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_guild_user (guild_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'warns' criada/verificada com sucesso!");

    // Tabela economia_usuarios
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS economia_usuarios (
        user_id VARCHAR(20) PRIMARY KEY,
        carteira INT DEFAULT 0,
        banco INT DEFAULT 0,
        ultima_daily DATETIME DEFAULT NULL,
        ultima_trabalhar DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'economia_usuarios' criada/verificada com sucesso!");

    // Tabela economia_profissoes
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS economia_profissoes (
        user_id VARCHAR(20) PRIMARY KEY,
        profissao VARCHAR(100) DEFAULT 'Nenhuma'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'economia_profissoes' criada/verificada com sucesso!");

    // Tabela economia_loja
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS economia_loja (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_nome VARCHAR(100) NOT NULL,
        preco INT NOT NULL,
        descricao TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'economia_loja' criada/verificada com sucesso!");

    // Tabela economia_inventario
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS economia_inventario (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        item_id INT NOT NULL,
        quantidade INT DEFAULT 1,
        FOREIGN KEY (item_id) REFERENCES economia_loja(id) ON DELETE CASCADE,
        KEY idx_user_guild (user_id, guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'economia_inventario' criada/verificada com sucesso!");

    // Tabela bot_stats
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS bot_stats (
        user_id VARCHAR(20) PRIMARY KEY,
        wins INT DEFAULT 0,
        draws INT DEFAULT 0,
        losses INT DEFAULT 0,
        total INT DEFAULT 0,
        facil_wins INT DEFAULT 0,
        facil_draws INT DEFAULT 0,
        facil_losses INT DEFAULT 0,
        medio_wins INT DEFAULT 0,
        medio_draws INT DEFAULT 0,
        medio_losses INT DEFAULT 0,
        dificil_wins INT DEFAULT 0,
        dificil_draws INT DEFAULT 0,
        dificil_losses INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'bot_stats' criada/verificada com sucesso!");

    // Tabela uvs_stats
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS uvs_stats (
        user_id VARCHAR(20) PRIMARY KEY,
        wins INT DEFAULT 0,
        draws INT DEFAULT 0,
        losses INT DEFAULT 0,
        total INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'uvs_stats' criada/verificada com sucesso!");

    // Tabela polls
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS polls (
        message_id VARCHAR(20) PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        title TEXT NOT NULL,
        options JSON NOT NULL,
        votes JSON NOT NULL,
        voters JSON DEFAULT NULL,
        unique_vote BOOLEAN DEFAULT TRUE,
        embed_color VARCHAR(7) DEFAULT '#0099ff',
        embed_footer TEXT,
        duration INT,
        created_at BIGINT NOT NULL,
        KEY idx_guild (guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'polls' criada/verificada com sucesso!");

    // Tabela contagens
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS contagens (
        guild_id VARCHAR(20) PRIMARY KEY,
        canal_id VARCHAR(20) NOT NULL,
        ultima_contagem INT DEFAULT 0,
        ativo BOOLEAN DEFAULT FALSE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'contagens' criada/verificada com sucesso!");

    console.log("✅ Todas as tabelas foram inicializadas com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao iniciar o MySQL:", error);
    process.exit(1);
  }
}

module.exports = { initMySQL };