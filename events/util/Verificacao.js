const { pool } = require('../../handlers/db.js');

module.exports = {
  name: 'verify',
  async execute(interaction) {
    // Verifica se a interação é de botão
    if (!interaction.isButton()) return;

    if (interaction.customId === 'verify_button') {
      const roleName = 'Verificado';
      // Procura o cargo pelo nome
      const role = interaction.guild.roles.cache.find(r => r.name === roleName);

      // Emojis escolhidos
      const verifiedEmoji = '<:eg_member:1353597138411585628>';
      const errorEmoji = '<:eg_wrong:1353597181659058257>';
      const warningEmoji = '<:eg_cautions:1353597102583844906>';

      if (!role) {
        return interaction.reply({ 
          content: `${errorEmoji} **Erro:** O cargo **"${roleName}"** não foi encontrado. Contate um administrador.`,
          ephemeral: true
        });
      }

      // Verifica se o membro já possui o cargo
      if (interaction.member.roles.cache.has(role.id)) {
        return interaction.reply({ 
          content: `${warningEmoji} Você já está verificado!`, 
          ephemeral: true
        });
      }

      try {
        // Adiciona o cargo ao membro
        await interaction.member.roles.add(role);

        // Registra a verificação no banco de dados
        await pool.execute(
          `INSERT INTO verified_users (user_id, guild_id, verificado, verified_at)
           VALUES (?, ?, TRUE, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE verificado = TRUE, verified_at = CURRENT_TIMESTAMP`,
          [interaction.user.id, interaction.guild.id]
        );

        return interaction.reply({ 
          content: `${verifiedEmoji} **Sucesso!** Você foi verificado e recebeu o cargo **${roleName}**! 🎉`, 
          ephemeral: true 
        });
      } catch (error) {
        console.error('Erro ao adicionar cargo ou inserir registro no DB:', error);
        return interaction.reply({ 
          content: `${errorEmoji} **Erro:** Ocorreu um problema ao verificar você. Tente novamente mais tarde.`,
          ephemeral: true 
        });
      }
    }
  },
};