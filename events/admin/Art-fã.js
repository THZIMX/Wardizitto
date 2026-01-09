const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');

const DONO_ID = '1033922089436053535';
const CANAL_PUBLICO_ID = '1385096740662935622';

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (!interaction.isButton()) return;

    const { customId, message, user, client, guild } = interaction;
    const isAprovar = customId.startsWith('aprovar_fanart_');
    const isRejeitar = customId.startsWith('rejeitar_fanart_');
    if (!isAprovar && !isRejeitar) return;

    if (user.id !== DONO_ID) {
      return interaction.reply({
        content: '❌ Apenas o moderador pode usar este botão.',
        ephemeral: true
      });
    }

    const [, , autorId] = customId.split('_');
    const guildId = guild?.id || 'global';
    const embed = EmbedBuilder.from(message.embeds[0]);

    if (isAprovar) {
      const canalPublico = client.channels.cache.get(CANAL_PUBLICO_ID);
      if (!canalPublico) {
        return interaction.reply({ content: '❌ Canal público não encontrado.', ephemeral: true });
      }

      // Reupando imagem da embed
      const imageUrl = embed.data.image?.url;
      let attachment;
      if (imageUrl) {
        try {
          const response = await fetch(imageUrl);
          const buffer = await response.arrayBuffer();
          attachment = new AttachmentBuilder(Buffer.from(buffer), { name: 'fanart.png' });
          embed.setImage('attachment://fanart.png');
        } catch (err) {
          console.error('Erro ao baixar imagem:', err);
        }
      }

      embed.setColor('Green').setTitle('🎉 Fanart Aprovada!');
      await canalPublico.send({
        embeds: [embed],
        files: attachment ? [attachment] : []
      });

      await message.edit({ embeds: [embed], components: [] });
      return interaction.reply({ content: '✅ Fanart aprovada e publicada!', ephemeral: true });
    }

    if (isRejeitar) {
      embed.setColor('Red').addFields({ name: '❌ Status', value: 'Fanart rejeitada e aviso aplicado.' });

      try {
        const userObj = await client.users.fetch(autorId);
        await userObj.send('❌ Sua fanart foi rejeitada por violar as diretrizes. Você recebeu 1 aviso no servidor.');
      } catch (err) {
        console.warn(`❌ Não foi possível enviar DM para o usuário ${autorId}.`);
      }

      try {
        const conn = await client.mariaDB.getConnection();
        await conn.query(`
          INSERT INTO avisos (guild_id, user_id, quantidade)
          VALUES (?, ?, 1)
          ON DUPLICATE KEY UPDATE quantidade = quantidade + 1
        `, [guildId, autorId]);
        conn.release();
      } catch (err) {
        console.error('❌ Erro ao registrar aviso no banco:', err);
      }

      await message.edit({ embeds: [embed], components: [] });
      return interaction.reply({ content: '🚫 Fanart rejeitada. Aviso aplicado.', ephemeral: true });
    }
  }
};