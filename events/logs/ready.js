const { Client, ActivityType } = require('discord.js');
const fs = require('fs').promises;

// Configurações
const STATUS_CHANNEL_ID = '1398762949551853708'; // 📌 Substitua pelo ID do canal
const LOG_FILE = './bot_status_logs.json'; // Arquivo para guardar histórico

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`\n[${new Date().toLocaleString()}] ⚡ Bot ${client.user.tag} iniciou!`);

        // —— 1. FUNÇÃO PARA REGISTRAR STATUS —— //
        const sendStatus = async (status, isRestart = false) => {
            try {
                const channel = await client.channels.fetch(STATUS_CHANNEL_ID);
                if (!channel) return;

                const statusMsg = isRestart
                    ? `🔁 **BOT REINICIOU** (${new Date().toLocaleString('pt-BR')})` 
                    : status === 'online'
                        ? `🟢 **BOT ONLINE** (${new Date().toLocaleString('pt-BR')})`
                        : `🔴 **BOT OFFLINE** (${new Date().toLocaleString('pt-BR')})`;

                await channel.send(statusMsg);

                // Salva no log (formato JSON)
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    status: status,
                    isRestart: isRestart
                };
                
                let logs = [];
                try {
                    const existingData = await fs.readFile(LOG_FILE, 'utf-8');
                    logs = JSON.parse(existingData);
                } catch (err) {
                    console.log('Arquivo de log não encontrado. Criando novo...');
                }
                
                logs.push(logEntry);
                await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));

            } catch (error) {
                console.error('Erro ao registrar status:', error);
            }
        };

        // —— 2. VERIFICA SE FOI UM REINÍCIO —— //
        let isRestart = false;
        try {
            const logsRaw = await fs.readFile(LOG_FILE, 'utf-8');
            const logs = JSON.parse(logsRaw);
            
            if (logs.length > 0) {
                const lastEntry = logs[logs.length - 1];
                // Se o último status foi "online" há menos de 5 minutos, considera como reinício
                if (lastEntry.status === 'online' && (new Date() - new Date(lastEntry.timestamp) < 2000)) {
                    isRestart = true;
                }
            }
        } catch (err) {
            console.log('⚠️ Não foi possível verificar logs anteriores.');
        }

        // —— 3. ENVIA MENSAGEM DE STATUS —— //
        await sendStatus('online', isRestart);

        // —— 4. CONFIGURA EVENTOS DE DESLIGAMENTO —— //
        const gracefulShutdown = async () => {
            await sendStatus('offline');
            process.exit();
        };

        process.on('SIGINT', gracefulShutdown);  // Ctrl+C no terminal
        process.on('SIGTERM', gracefulShutdown); // Comando "kill"
        process.on('exit', () => sendStatus('offline')); // Emergência

        // —— (OPCIONAL) ATUALIZA PRESENÇA DO BOT —— //
        const updatePresence = () => {
            client.user.setPresence({
                activities: [{ 
                    name: `${client.guilds.cache.size} servidores`, 
                    type: ActivityType.Watching 
                }],
                status: 'online'
            });
        };
        updatePresence();
    }
};