const { Events } = require("discord.js");

async function updateServerCount(client) {
// Espera um pouco para garantir que a cache foi atualizada
await new Promise((resolve) => setTimeout(resolve, 2000));

const guild = client.guilds.cache.get("1133613631817392211"); // ID do seu servidor principal  
if (!guild) return;  

const channelId = "1341629244312391680"; // ID do canal de voz que mostrará os servidores  
const channel = guild.channels.cache.get(channelId);  

if (channel && channel.isVoiceBased()) {  
    await channel.setName(`「🌍」 Servidores: ${client.guilds.cache.size}`);  
}

}

module.exports = (client) => {
client.once(Events.ClientReady, async () => {
await updateServerCount(client);
});

client.on(Events.GuildCreate, async () => {  
    console.log("Bot entrou em um novo servidor!");  
    await updateServerCount(client);  
});  

client.on(Events.GuildDelete, async () => {  
    console.log("Bot foi removido de um servidor!");  
    await updateServerCount(client);  
});

};

