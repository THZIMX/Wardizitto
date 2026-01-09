const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        try {
            // Criar embed de boas-vindas
            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x2F3136)
                .setTitle(`🛡️ ${guild.client.user.username} chegou no servidor!`)
                .setThumbnail(guild.client.user.displayAvatarURL())
                .setDescription(`
**Olá pessoal do ${guild.name}!** 🎉

Sou o **${guild.client.user.username}**, seu bot de administração, diversão e utilidades com diversos recursos incríveis para seu servidor!
                `)
                .addFields(
                    {
                        name: '📝 **Como me usar?**',
                        value: 'Digite \`/ajuda\` para ver todos os comandos disponíveis!',
                        inline: true
                    },
                    {
                        name: '🔔 **Importante!**',
                        value: 'Estou em constante evolução! Se alguma função parar de funcionar, atualize-a. Sempre verifique as atualizações no nosso servidor de suporte.',
                        inline: true
                    },
                    {
                        name: '🌐 **Links Úteis**',
                        value: '**[Servidor de Suporte](https://discord.gg/rwWhZ4GjWP)** | **[Site Oficial](https://mightward.abccloud.com.br)**',
                        inline: false
                    }
                )
                .setImage('https://cdn.discordapp.com/banners/1327479686321934458/12d17aceb6c32d014e69fa266ea39bcc.webp?size=512')
                .setFooter({
                    text: 'Obrigado por me adicionar! • Em caso de problemas, contate um administrador',
                    iconURL: guild.iconURL()
                });

            // 1. Tentar enviar DM para o dono
            try {
                const owner = await guild.fetchOwner();
                if (owner) {
                    await owner.send({ embeds: [welcomeEmbed] });
                    return; // Se conseguiu mandar DM, não precisa mandar no servidor
                }
            } catch (dmError) {
                console.warn('Não foi possível enviar DM para o dono:', dmError);
            }

            // 2. Caso a DM falhe, procurar canal adequado
            const preferredChannels = ['bot-commands', 'comandos', 'staff', 'chat-geral', 'geral'];
            let targetChannel = guild.systemChannel;

            if (!targetChannel || !guild.members.me.permissionsIn(targetChannel).has(PermissionFlagsBits.SendMessages)) {
                targetChannel = guild.channels.cache.find(
                    c => preferredChannels.includes(c.name) &&
                    c.type === ChannelType.GuildText &&
                    c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
                );
            }

            if (!targetChannel) {
                targetChannel = guild.channels.cache.find(
                    c => c.type === ChannelType.GuildText &&
                    c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
                );
            }

            // 3. Enviar no canal, se encontrado
            if (targetChannel) {
                await targetChannel.send({
                    content: `**Novo bot adicionado!** 👋`,
                    embeds: [welcomeEmbed]
                });
            }

        } catch (error) {
            console.error('Erro no evento GuildCreate:', error);
        }
    }
};