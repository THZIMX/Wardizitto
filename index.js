const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mysql = require('mysql2/promise');
const config = require('./config.json');
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');

// Verificações básicas
if (!config.token) {
  console.error("❌ ERRO: Token do bot não foi definido no config.json!");
  process.exit(1);
}

if (!config.mariaDB) {
  console.error("❌ ERRO: Configuração do MariaDB não foi definida no config.json!");
  process.exit(1);
}

// Cria o client do bot com TODAS as intents
const client = new Client({
  intents: Object.values(GatewayIntentBits),
});

client.commands = new Collection();

// Conexão com o banco MariaDB
async function connectDatabase() {
  try {
    client.mariaDB = await mysql.createPool({
      host: config.mariaDB.host,
      user: config.mariaDB.user,
      password: config.mariaDB.password,
      database: config.mariaDB.database,
      waitForConnections: true,
      connectionLimit: 10,
    });
    console.log('✅ Conectado ao MariaDB!');
  } catch (err) {
    console.error('❌ Erro ao conectar ao MariaDB:', err);
    process.exit(1);
  }
}

// Inicia o bot
connectDatabase().then(async () => {
  commandHandler(client);
  eventHandler(client);
});

// Mensagem ao iniciar
client.on('ready', () => {
  console.log(`🤖 Bot online: ${client.user.tag}`);
});

// Login no Discord
client.login(config.token);

// Exporta o client
module.exports = client;