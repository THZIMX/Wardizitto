const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

module.exports = (client) => {
  client.commands = new Collection();
  client.contextMenus = new Collection();

  const commandsPath = path.join(__dirname, '../commands');

  // 🔁 Função recursiva para ler comandos
  const loadCommands = (dir) => {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);

      if (fs.lstatSync(filePath).isDirectory()) {
        loadCommands(filePath);
      } else if (file.endsWith('.js')) {
        try {
          const command = require(filePath);

          if (command?.data && typeof command.data.toJSON === 'function' && typeof command.execute === 'function') {
            // Slash Command (data + execute)
            client.commands.set(command.data.name, command);
            console.log(`✅ Slash Command carregado: ${command.data.name}`);
          } else if (command?.name && typeof command.run === 'function') {
            // Comando Clássico (name + run)
            client.commands.set(command.name, command);
            console.log(`✅ Comando clássico carregado: ${command.name}`);
          } else {
            console.warn(`⚠️ Ignorado (formato inválido): ${file}`);
          }

        } catch (err) {
          console.error(`❌ Erro ao carregar o comando ${file}:`, err);
        }
      }
    }
  };

  // Carrega os comandos da pasta
  loadCommands(commandsPath);

  // Registra os Slash Commands no Discord ao iniciar
  client.once('ready', async () => {
    try {
      console.log('🔄 Registrando Slash Commands...');

      const slashCommands = client.commands
        .filter(cmd => cmd.data && typeof cmd.data.toJSON === 'function')
        .map(cmd => cmd.data.toJSON());

      if (slashCommands.length > 0) {
        await client.application.commands.set(slashCommands);
        console.log(`✅ ${slashCommands.length} Slash Commands registrados.`);
      } else {
        console.warn('⚠️ Nenhum Slash Command encontrado.');
      }

      // Remove comandos antigos que não existem mais
      const registered = await client.application.commands.fetch();
      for (const cmd of registered.values()) {
        if (!client.commands.has(cmd.name)) {
          await client.application.commands.delete(cmd.id);
          console.log(`🗑️ Removido comando obsoleto: ${cmd.name}`);
        }
      }
    } catch (err) {
      console.error('❌ Erro ao registrar Slash Commands:', err);
    }
  });
};