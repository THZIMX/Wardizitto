const { Events } = require('discord.js');
const { pool } = require('../handlers/db.js');

// Cache de cooldowns
const cooldowns = new Map();

// Importações externas fora do handler (melhor desempenho)
const VerificacaoHandler = require('./util/Verificacao.js');
const TicketHandler = require('./admin/TicketHandler.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // 📌 Responde quando o bot é mencionado em um componente
      if (
        interaction.isMessageComponent() &&
        interaction.message.mentions?.has?.(interaction.client.user)
      ) {
        await interaction.reply({
          content: '👋 Oi! Use o comando `/ajuda` para ver minhas funções!',
          ephemeral: true
        });
        return;
      }

      // 🚀 Slash Commands
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
          console.warn(`Comando não encontrado: /${interaction.commandName}`);
          return interaction.reply({
            content: '❌ Este comando não está registrado corretamente.',
            ephemeral: true
          });
        }

        const commandName = command.name || command.data?.name;
        const cooldownTime = 3000; // 3 segundos
        const now = Date.now();
        const userId = interaction.user.id;

        if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
        const timestamps = cooldowns.get(commandName);

        if (timestamps.has(userId)) {
          const expiration = timestamps.get(userId) + cooldownTime;
          if (now < expiration) {
            const timeLeft = ((expiration - now) / 1000).toFixed(1);
            return interaction.reply({
              content: `⏳ Espere **${timeLeft}s** para usar \`/${commandName}\` novamente.`,
              ephemeral: true
            });
          }
        }

        timestamps.set(userId, now);
        setTimeout(() => timestamps.delete(userId), cooldownTime);

        // Executa o comando
        await command.execute(interaction, interaction.client);
      }

      // 🎛️ Botões, Modais e Select Menus
      if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
        const handlers = {
          'verificar_button': VerificacaoHandler,
          'open_ticket': TicketHandler,
          'close_ticket': TicketHandler,
          'claim_ticket': TicketHandler,
          'config_ticket_channels': TicketHandler,
          'config_ticket_appearance': TicketHandler,
          'send_ticket_panel': TicketHandler,
          'modal_ticket_channels': TicketHandler,
          'modal_ticket_appearance': TicketHandler,
          'select_ticket_category': TicketHandler,
          'select_ticket_channels': TicketHandler,
          'select_ticket_role': TicketHandler
        };

        const handler = handlers[interaction.customId];
        if (handler) {
          await handler.execute(interaction, interaction.client);
        }
      }

      // 🔍 Autocomplete
      if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (command?.autocomplete) {
          await command.autocomplete(interaction, interaction.client);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao processar interação:', error);

      const errorMsg = {
        content: '⚠️ Ocorreu um erro ao processar sua interação.',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg).catch(() => {});
      } else {
        await interaction.reply(errorMsg).catch(() => {});
      }
    }
  }
};