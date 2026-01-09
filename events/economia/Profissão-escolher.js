const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../handlers/db');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'selecionar_profissao') return;

    const userId = interaction.user.id;
    const selectedProfession = interaction.values[0];

    // Emojis personalizados
    const emojis = {
      tools: '<:icons_tools:1353597168912437341>',
      correct: '<a:correct:1353898613494779974>',
      wrong: '<:icons_wrong:1353597190920212573>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

    try {
      // Atualizar ou inserir a profissão no banco
      await db.query(`
        INSERT INTO economia_profissoes (user_id, profissao)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE profissao = ?
      `, [userId, selectedProfession, selectedProfession]);

      // Criar banner
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');

      // Fundo
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Carregar avatar
      const avatar = await loadImage(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true); // Avatar circular
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 20, 20, 80, 80);
      ctx.restore();

      // Borda do avatar
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.stroke();

      // Texto
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`Profissão: ${selectedProfession}`, 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText('Use /trabalhar para ganhar Wardcoins!', 120, 90);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'profissao-selected.png' });

      // Embed de sucesso
      const embed = new EmbedBuilder()
        .setTitle(`${emojis.tools} Profissão Escolhida`)
        .setDescription(`${emojis.correct} Você escolheu **${selectedProfession}**! Use **/trabalhar** para ganhar Wardcoins!`)
        .setColor('#00BFFF')
        .addFields({
          name: `${emojis.star} Próximo Passo`,
          value: 'Experimente o comando `/trabalhar`!',
          inline: false,
        })
        .setImage('attachment://profissao-selected.png')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.update({
        content: null,
        embeds: [embed],
        components: [],
        files: [attachment],
        ephemeral: true, // Corrigido aqui
      });

    } catch (err) {
      console.error('Erro ao processar seleção de profissão:', err);

      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao salvar sua profissão. Tente novamente mais tarde.')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.update({
        content: null,
        embeds: [embedErro],
        ephemeral: true, // Corrigido aqui também
      });
    }
  },
};