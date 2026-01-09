const { Events, EmbedBuilder } = require('discord.js');


module.exports = {
  name: Events.InteractionCreate, // 🔧 Corrigido
  async execute(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('github_select_')) return;

    const username = interaction.customId.split('_')[2];
    const repoName = interaction.values[0];
    const repoUrl = `https://api.github.com/repos/${username}/${repoName}`;

    try {
      const repo = await fetch(repoUrl).then(res => res.json());

      const embed = new EmbedBuilder()
        .setTitle(`<:icons_gitbranch:1353597274541789225> ${repo.full_name}`)
        .setURL(repo.html_url)
        .setDescription(repo.description || 'Sem descrição')
        .addFields(
          {
            name: '<:icons_code:1353597423682981908> Linguagem',
            value: repo.language || 'N/A',
            inline: true
          },
          {
            name: '<:icons_star:1353597390673936448> Estrelas',
            value: `${repo.stargazers_count}`,
            inline: true
          },
          {
            name: '<:icons_gitmerge:1353597277050114108> Forks',
            value: `${repo.forks_count}`,
            inline: true
          },
          {
            name: '<:icons_issue:1353597278098685964> Issues abertas',
            value: `${repo.open_issues_count}`,
            inline: true
          },
          {
            name: '<:icons_book:1353597672371785788> Licença',
            value: repo.license?.name || 'Nenhuma',
            inline: true
          }
        )
        .setFooter({
          text: `Atualizado em ${new Date(repo.updated_at).toLocaleDateString('pt-BR')}`
        })
        .setColor(0x2f81f7)
        .setThumbnail('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png');

      await interaction.update({
        embeds: [embed],
        components: [interaction.message.components[0]]
      });
    } catch (error) {
      console.error(error);
      interaction.reply({
        content: '<:icons_warning:1353597798662148117> Erro ao buscar o repositório selecionado.',
        ephemeral: true
      });
    }
  }
};