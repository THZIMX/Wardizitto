const { WebhookClient } = require('discord.js');
const config = require('../../config.json');

module.exports = (client) => {
    if (!config.webhookLogs || !config.webhookLogs.url) {
        console.error('❌ ERRO: Webhook URL não está definido no config.json!');
        return;
    }

    const webhook = new WebhookClient({ url: config.webhookLogs.url });

    client.on('guildCreate', async (guild) => {
        console.log(`✅ Bot foi adicionado ao servidor: ${guild.name} (${guild.id})`);
        webhook.send({
            content: `✅ <@1033922089436053535> O bot entrou no servidor **${guild.name}** (\`${guild.id}\`)`,
        }).catch(console.error);
    });

    client.on('guildDelete', async (guild) => {
        console.log(`❌ Bot foi removido do servidor: ${guild.name} (${guild.id})`);
        webhook.send({
            content: `❌ O bot foi removido do servidor **${guild.name}** (\`${guild.id}\`)`,
        }).catch(console.error);
    });
};