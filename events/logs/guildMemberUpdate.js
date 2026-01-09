const { Events } = require("discord.js");

async function updateMemberCount(guild) {
// Aguarda um pouco para garantir que a contagem foi atualizada
await new Promise((resolve) => setTimeout(resolve, 2000));

const channelId = "1341629716397817948"; // Substitua pelo ID do canal de voz que mostrará os membros  
const channel = guild.channels.cache.get(channelId);  

if (channel && channel.isVoiceBased()) {  
    await channel.setName(`「👥」 Membros: ${guild.memberCount}`);    
} else {  
}

}

module.exports = (client) => {
client.once(Events.ClientReady, async () => {
client.guilds.cache.forEach(async (guild) => {
await updateMemberCount(guild);
});
});

client.on(Events.GuildMemberAdd, async (member) => {  
    await updateMemberCount(member.guild);  
});  

client.on(Events.GuildMemberRemove, async (member) => {  
    await updateMemberCount(member.guild);  
});

};

