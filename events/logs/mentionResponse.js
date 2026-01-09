const {
    Events,
    EmbedBuilder,
    escapeMarkdown,
    Collection,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const cooldowns = new Collection();
const COOLDOWN_TIME = 10 * 1000;

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        const botId = message.client.user.id;
        const isDirectMention = message.content.trim().startsWith(`<@${botId}>`) || message.content.trim().startsWith(`<@!${botId}>`);
        if (!isDirectMention) return;

        const now = Date.now();
        const lastUsed = cooldowns.get(message.author.id);
        if (lastUsed && (now - lastUsed) < COOLDOWN_TIME) return;

        cooldowns.set(message.author.id, now);
        setTimeout(() => cooldowns.delete(message.author.id), COOLDOWN_TIME);

        const botAvatar = message.client.user.displayAvatarURL({ dynamic: true });

        const tools = '<:eg_tools:1353597168912437341>';
        const question = '<:eg_question:1353597152965689375>';
        const book = '<:eg_book:1353597098389667932>';
        const star = '<a:estrela:1353898619731968050>';
        const divider = '━━━━━━━━━━━━━━━━━━━━━━━━';

        const embed = new EmbedBuilder()
            .setColor('#0078FF')
            .setAuthor({
                name: `${message.client.user.username} • Assistente Inteligente`,
                iconURL: botAvatar,
            })
            .setTitle(` ${tools} Olá, ${escapeMarkdown(message.author.username)}!`)
            .setDescription([
                `${star} **Obrigado por me mencionar!**`,
                `Sou o **Wardizitto**, um bot multifuncional criado para ajudar na administração, entretenimento e segurança do seu servidor.`,
                ``,
                `${divider}`,
                ``,
                `${question} • Use \`/ajuda\` para ver todos os comandos disponíveis.`,
                `${book} • Me adicione ao seu servidor: [Clique aqui](https://mightward.wardizitto.com.br/)`,
                ``,
                `${divider}`,
                ``,
                `**Links úteis:**`,
                `• [Termos de Serviço](https://mightward.abccloud.com.br/termos.html)`,
                `• [Política de Privacidade](https://wardizitto.abccloud.com.br/privacidade.html)`
            ].join('\n'))
            .setFooter({
                text: 'Wardizitto - Seu assistente de confiança!',
                iconURL: botAvatar,
            })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Convidar o Bot')
                .setStyle(ButtonStyle.Link)
                .setURL('https://wardizitto.abccloud.com.br/'),

            new ButtonBuilder()
                .setLabel('Suporte')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.gg/rwWhZ4GjWP')
        );

        await message.reply({
            embeds: [embed],
            components: [row]
        }).catch(err =>
            console.error(`Erro ao responder menção de ${message.author.tag}:`, err)
        );
    },
};