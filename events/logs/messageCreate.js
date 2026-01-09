const { EmbedBuilder } = require('discord.js');
const { pool } = require('../../handlers/db.js'); // Usa sua conexão do MariaDB

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    try {
      // 🔍 Verifica se o autor da mensagem estava AFK
      const [afkRows] = await pool.query(
        'SELECT * FROM afk_status WHERE user_id = ?',
        [message.author.id]
      );

      if (afkRows.length > 0) {
        // ❌ Remove o status AFK
        await pool.query(
          'DELETE FROM afk_status WHERE user_id = ?',
          [message.author.id]
        );

        const backEmbed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('🎉 Bem-vindo de volta!')
          .setDescription(`${message.author}, seu status AFK foi removido.`);

        message.channel.send({ embeds: [backEmbed] }).catch(() => {});
      }

      // 🔁 Verifica se a mensagem menciona alguém que está AFK
      for (const user of message.mentions.users.values()) {
        const [mentionedRows] = await pool.query(
          'SELECT * FROM afk_status WHERE user_id = ?',
          [user.id]
        );

        if (mentionedRows.length > 0) {
          const afkUser = mentionedRows[0];
          const afkEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🚨 Usuário AFK')
            .setDescription(`**${user.tag}** está AFK!\n💬 **Mensagem:** ${afkUser.mensagem}`)
            .setFooter({ text: 'Ele pode demorar a responder.' });

          message.reply({ embeds: [afkEmbed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status AFK:', err);
    }
  },
};