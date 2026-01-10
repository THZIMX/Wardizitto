const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require('discord.js');
const { pool } = require('../../handlers/db.js');
const { MySQL } = require('../../config.json');

const ownerId = '1033922089436053535';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remover-tabelas')
    .setDescription('Lista as tabelas e permite selecionar uma para excluir.'),

  async execute(interaction) {
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('Acesso Negado')
            .setDescription('Você não tem permissão para executar este comando.')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const [rows] = await pool.execute(`SHOW TABLES`);
      const tableKey = `Tables_in_${MySQL.database}`;
      const tables = rows.map(row => row[tableKey]);

      if (tables.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('Orange')
              .setTitle('Nenhuma Tabela Encontrada')
              .setDescription('O banco de dados está vazio.')
          ],
          components: []
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_table')
        .setPlaceholder('Selecione uma tabela para excluir')
        .addOptions(tables.map(table => ({
          label: table,
          value: table
        })));

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);

      const msg = await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('Blue')
            .setTitle('Selecione a Tabela')
            .setDescription('Escolha uma tabela abaixo para confirmar sua exclusão.')
        ],
        components: [selectRow]
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 30000,
        filter: i => i.user.id === interaction.user.id
      });

      collector.on('collect', async i => {
        const selectedTable = i.values[0];

        const confirmButton = new ButtonBuilder()
          .setCustomId('confirm_delete')
          .setLabel('Confirmar Exclusão')
          .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary);

        const buttonRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await i.update({
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('Confirmação')
              .setDescription(`Você selecionou a tabela \`${selectedTable}\`.\nTem certeza que deseja excluí-la?`)
          ],
          components: [buttonRow]
        });

        const buttonCollector = msg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000,
          filter: btn => btn.user.id === interaction.user.id
        });

        buttonCollector.on('collect', async btn => {
          try {
            await btn.deferUpdate().catch(() => {});

            if (btn.customId === 'confirm_delete') {
              try {
                await pool.execute(`DROP TABLE IF EXISTS \`${selectedTable}\``);

                const disabledButtons = new ActionRowBuilder().addComponents(
                  btn.message.components[0].components.map(b =>
                    ButtonBuilder.from(b).setDisabled(true)
                  )
                );

                await interaction.editReply({
                  embeds: [
                    new EmbedBuilder()
                      .setColor('Green')
                      .setTitle('✅ Sucesso')
                      .setDescription(`Tabela \`${selectedTable}\` removida com sucesso.`)
                  ],
                  components: [disabledButtons]
                });

                collector.stop();
                buttonCollector.stop();

              } catch (err) {
                if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                  // Buscar tabelas que referenciam essa
                  const [constraints] = await pool.execute(`
                    SELECT TABLE_NAME, CONSTRAINT_NAME
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE REFERENCED_TABLE_NAME = ? AND CONSTRAINT_SCHEMA = ?;
                  `, [selectedTable, mariaDB.database]);

                  const msgErro = constraints.length
                    ? constraints.map(c => `• **${c.TABLE_NAME}** → Constraint: \`${c.CONSTRAINT_NAME}\``).join('\n')
                    : 'Não foi possível identificar os vínculos.';

                  await btn.followUp({
                    embeds: [
                      new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('🔒 Tabela Referenciada')
                        .setDescription(
                          `A tabela \`${selectedTable}\` está sendo referenciada por outras tabelas e não pode ser excluída.\n\n${msgErro}`
                        )
                    ],
                    ephemeral: true
                  });

                } else {
                  console.error('Erro ao excluir tabela:', err);
                  await btn.followUp({
                    embeds: [
                      new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('Erro')
                        .setDescription('Não foi possível excluir a tabela.')
                    ],
                    ephemeral: true
                  });
                }
              }

            } else if (btn.customId === 'cancel_delete') {
              const disabledButtons = new ActionRowBuilder().addComponents(
                btn.message.components[0].components.map(b =>
                  ButtonBuilder.from(b).setDisabled(true)
                )
              );

              await interaction.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor('DarkGrey')
                    .setTitle('Cancelado')
                    .setDescription('A exclusão da tabela foi cancelada.')
                ],
                components: [disabledButtons]
              });

              collector.stop();
              buttonCollector.stop();
            }

          } catch (error) {
            console.warn('Erro ao processar botão:', error);
          }
        });

        buttonCollector.on('end', async () => {
          try {
            const updatedMsg = await interaction.fetchReply();
            const disabled = updatedMsg.components.map(row =>
              new ActionRowBuilder().addComponents(
                row.components.map(c => ButtonBuilder.from(c).setDisabled(true))
              )
            );
            await interaction.editReply({ components: disabled });
          } catch (e) {}
        });
      });

      collector.on('end', async () => {
        try {
          const updatedMsg = await interaction.fetchReply();
          const disabled = updatedMsg.components.map(row =>
            new ActionRowBuilder().addComponents(
              row.components.map(c => c.setDisabled(true))
            )
          );
          await interaction.editReply({ components: disabled });
        } catch (err) {}
      });

    } catch (error) {
      console.error('Erro geral:', error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('Erro')
            .setDescription('Erro ao buscar as tabelas ou conectar ao banco.')
        ],
        components: []
      });
    }
  }
};