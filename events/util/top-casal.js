module.exports = {
  name: 'topCasal',
  async execute(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('topcasais_')) return;

    try {
      await interaction.deferUpdate(); // Remove o "thinking" do botão

      const { pool } = require('../../handlers/db');
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const { format, differenceInDays } = require('date-fns');
      const { ptBR } = require('date-fns/locale');

      // Extrai a ação e a página atual dos dados do embed
      const action = interaction.customId.split('_')[1];
      const embedOriginal = interaction.message.embeds[0];
      const matchPagina = embedOriginal.title.match(/Página (\d+)\/(\d+)/);
      
      if (!matchPagina) {
        return await interaction.followUp({
          content: 'Não foi possível identificar a paginação atual.',
          ephemeral: true
        });
      }

      const paginaAtual = parseInt(matchPagina[1]);
      const totalPaginas = parseInt(matchPagina[2]);
      const itensPorPagina = 10;

      let novaPagina = paginaAtual;
      
      // Determina a nova página com base na ação
      switch (action) {
        case 'prev':
          novaPagina = Math.max(1, paginaAtual - 1);
          break;
        case 'next':
          novaPagina = Math.min(totalPaginas, paginaAtual + 1);
          break;
        case 'refresh':
          // Mantém a mesma página
          break;
        default:
          return await interaction.followUp({
            content: 'Ação não reconhecida.',
            ephemeral: true
          });
      }

      // Consulta os casais para a nova página
      const [casais] = await pool.query(
        `SELECT 
          user_id, 
          parceiro_id, 
          data 
         FROM casamentos 
         ORDER BY data ASC 
         LIMIT ? OFFSET ?`,
        [itensPorPagina, (novaPagina - 1) * itensPorPagina]
      );

      if (!casais || casais.length === 0) {
        return await interaction.followUp({
          content: 'Não há casais nesta página.',
          ephemeral: true
        });
      }

      // Processa os casais
      const casaisFormatados = await Promise.all(
        casais.map(async (casal, index) => {
          try {
            const posicao = (novaPagina - 1) * itensPorPagina + index + 1;
            const user1 = await interaction.client.users.fetch(casal.user_id).catch(() => ({ username: 'Usuário Desconhecido' }));
            const user2 = await interaction.client.users.fetch(casal.parceiro_id).catch(() => ({ username: 'Usuário Desconhecido' }));

            const dataCasamento = new Date(Number(casal.data));
            const diasCasados = differenceInDays(new Date(), dataCasamento);
            const dataFormatada = format(dataCasamento, "dd/MM/yyyy", { locale: ptBR });

            return {
              posicao,
              casal: `${user1.username} ❤️ ${user2.username}`,
              dias: diasCasados,
              data: dataFormatada
            };
          } catch (error) {
            console.error('Erro ao processar casal:', error);
            return null;
          }
        })
      );

      // Filtra casais inválidos
      const casaisValidos = casaisFormatados.filter(casal => casal !== null);

      if (casaisValidos.length === 0) {
        return await interaction.followUp({
          content: 'Não foi possível carregar os casais desta página.',
          ephemeral: true
        });
      }

      // Cria a nova embed
      const novaEmbed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle(`💑 Top Casais Mais Antigos - Página ${novaPagina}/${totalPaginas}`)
        .setDescription(
          casaisValidos.map(casal => 
            `**#${casal.posicao}** - ${casal.casal}\n` +
            `⏳ ${casal.dias} dias | 📅 ${casal.data}`
          ).join('\n\n')
        )
        .setFooter({ text: `Atualizado em ${new Date().toLocaleString()}` });

      // Atualiza os botões
      const novosBotoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('topcasais_prev')
          .setLabel('◀️ Anterior')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(novaPagina <= 1),
        new ButtonBuilder()
          .setCustomId('topcasais_next')
          .setLabel('Próxima ▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(novaPagina >= totalPaginas),
        new ButtonBuilder()
          .setCustomId('topcasais_refresh')
          .setLabel('🔄 Atualizar')
          .setStyle(ButtonStyle.Secondary)
      );

      // Atualiza a mensagem original
      await interaction.editReply({
        embeds: [novaEmbed],
        components: [novosBotoes]
      });

    } catch (error) {
      console.error('Erro no handler de top-casais:', error);
      
      try {
        await interaction.followUp({
          content: 'Ocorreu um erro ao processar sua solicitação.',
          ephemeral: true
        });
      } catch (err) {
        console.error('Erro ao enviar mensagem de erro:', err);
      }
    }
  }
};