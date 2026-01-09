const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');
const { groqApiKey, groqModel } = require('../../config.json');
const defaultConfig = require('./default-config.json');

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// --- Funções Auxiliares ---

/**
 * Envia ou edita uma resposta de interação de forma segura.
 * @param {import('discord.js').CommandInteraction} interaction A interação original.
 * @param {import('discord.js').InteractionReplyOptions} options As opções da mensagem.
 */
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(options);
    } else {
      await interaction.reply(options);
    }
  } catch (error) {
    console.error('Falha ao enviar/editar resposta. Tentando DM.', error);
    try {
      await interaction.user.send({ content: 'Ocorreu um erro no canal original. Aqui está a atualização:', ...options });
    } catch (dmError) {
      console.error('Falha ao enviar DM como fallback.', dmError);
    }
  }
}

/**
 * Gera a configuração do servidor usando a API da Groq.
 * @param {string} descricao A descrição fornecida pelo usuário.
 * @returns {Promise<object|null>} A configuração gerada ou null em caso de falha.
 */
async function gerarConfigIA(descricao) {
  try {
    if (!groqModel) {
      throw new Error('Nome do modelo Groq não configurado em config.json.');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente que gera apenas código JSON válido para a configuração de um servidor Discord, sem nenhum texto, markdown ou explicação adicional. Siga estritamente a estrutura fornecida.'
          },
          {
            role: 'user',
            content: `Gere uma configuração de servidor Discord em formato JSON para a seguinte descrição: "${descricao}".
                      A estrutura do JSON DEVE ser: { "channels": [{ "name": "string", "type": "text"|"voice"|"category", "parent": "string"|null, "permissions": [{"role": "string", "allow": ["PermissionName"], "deny": ["PermissionName"]}] }], "roles": [{ "name": "string", "color": "#RRGGBB", "permissions": ["PermissionName"] }], "emojis": [{ "name": "string", "url": "string" }] }.
                      Responda APENAS com o JSON.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2048, 
      } ),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const jsonString = data.choices[0]?.message?.content;
    if (!jsonString) {
      throw new Error('A resposta da IA estava vazia.');
    }

    const cleanedJsonString = jsonString.replace(/```json\n|```/g, '').trim();
    return JSON.parse(cleanedJsonString);

  } catch (error) {
    console.error('Erro ao gerar configuração com IA:', error);
    return null;
  }
}

/**
 * Limpa os canais e cargos existentes no servidor.
 * @param {import('discord.js').Guild} guild O servidor.
 * @param {string} commandChannelId O ID do canal a ser preservado.
 */
async function limparServidor(guild, commandChannelId) {
  const preservedChannel = guild.channels.cache.get(commandChannelId);

  const channelPromises = guild.channels.cache
    .filter(c => c.id !== preservedChannel?.id && c.deletable)
    .map(c => c.delete().catch(e => console.error(`Falha ao deletar canal ${c.name}:`, e)));
  await Promise.all(channelPromises);

  const rolePromises = guild.roles.cache
    .filter(r => r.editable && !r.managed && r.id !== guild.roles.everyone.id)
    .map(r => r.delete().catch(e => console.error(`Falha ao deletar cargo ${r.name}:`, e)));
  await Promise.all(rolePromises);
}

/**
 * Aplica a configuração de canais, cargos e emojis ao servidor.
 * @param {import('discord.js').Guild} guild O servidor.
 * @param {object} config A configuração a ser aplicada.
 * @param {Map<string, string>} log O log de progresso.
 * @param {Function} updateProgress A função para atualizar o embed de progresso.
 */
async function aplicarConfiguracao(guild, config, log, updateProgress) {
  const { channels = [], roles = [], emojis = [] } = config;

  log.set('roles', '🎭 Criando cargos...');
  await updateProgress();
  const roleCreation = await Promise.allSettled(
    roles.map(role => guild.roles.create({
      name: role.name,
      color: role.color || '#99aab5',
      permissions: (role.permissions || []).map(p => PermissionFlagsBits[p]).filter(Boolean),
    }))
  );
  const createdRolesCount = roleCreation.filter(r => r.status === 'fulfilled').length;
  log.set('roles', `🎭 Cargos criados: ${createdRolesCount}/${roles.length}`);
  await updateProgress();
  await delay(1000);

  log.set('categories', '📂 Criando categorias...');
  await updateProgress();
  const categoryMap = new Map();
  const categoryConfigs = channels.filter(c => c.type === 'category');
  const categoryCreation = await Promise.allSettled(
    categoryConfigs.map(cat => guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory }))
  );
  categoryCreation.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      categoryMap.set(categoryConfigs[index].name, result.value.id);
    }
  });
  log.set('categories', `📂 Categorias criadas: ${categoryMap.size}/${categoryConfigs.length}`);
  await updateProgress();

  log.set('channels', '💬 Criando canais...');
  await updateProgress();
  const channelConfigs = channels.filter(c => c.type !== 'category');
  const channelCreation = await Promise.allSettled(
    channelConfigs.map(ch => {
      const permissionOverwrites = (ch.permissions || []).map(p => {
        const role = p.role === '@everyone' ? guild.roles.everyone : guild.roles.cache.find(r => r.name === p.role);
        if (!role) return null;
        return {
          id: role.id,
          allow: (p.allow || []).map(perm => PermissionFlagsBits[perm]).filter(Boolean),
          deny: (p.deny || []).map(perm => PermissionFlagsBits[perm]).filter(Boolean),
        };
      }).filter(Boolean);

      return guild.channels.create({
        name: ch.name,
        type: ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: ch.parent ? categoryMap.get(ch.parent) : undefined,
        permissionOverwrites,
      });
    })
  );
  const createdChannelsCount = channelCreation.filter(c => c.status === 'fulfilled').length;
  log.set('channels', `💬 Canais criados: ${createdChannelsCount}/${channelConfigs.length}`);
  await updateProgress();

  log.set('emojis', '😊 Criando emojis...');
  await updateProgress();
  const emojiCreation = await Promise.allSettled(
    emojis.map(emoji => guild.emojis.create({
      attachment: emoji.url,
      name: emoji.name.replace(/[^a-z0-9_]/gi, ''),
    }))
  );
  const createdEmojisCount = emojiCreation.filter(e => e.status === 'fulfilled').length;
  log.set('emojis', `😊 Emojis criados: ${createdEmojisCount}/${emojis.length}`);
  await updateProgress();

  return { createdRolesCount, createdChannelsCount: categoryMap.size + createdChannelsCount, createdEmojisCount };
}

// --- Comando Principal ---

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-servidor')
    .setDescription('Cria ou reorganiza o servidor com base em uma descrição textual.')
    .addStringOption(opt => opt.setName('descricao').setDescription('Descreva como você quer seu servidor (ex: "um servidor de comunidade para gamers").').setRequired(true).setMaxLength(1500))
    .addBooleanOption(opt => opt.setName('apagar').setDescription('Apagar TODOS os canais e cargos existentes antes de criar os novos? (Padrão: Não)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({ content: '⏳ Validando permissões e iniciando...', flags: MessageFlags.Ephemeral });

    const { guild, member, options, channelId } = interaction;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return safeReply(interaction, { content: '❌ Você precisa ser um **Administrador** para usar este comando.', ephemeral: true });
    }
    const botPerms = [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageEmojisAndStickers];
    const missingPerms = botPerms.filter(p => !guild.members.me.permissions.has(p));
    if (missingPerms.length) {
      return safeReply(interaction, { content: `❌ O bot não tem as permissões necessárias: **${missingPerms.map(p => p.toString()).join(', ')}**`, ephemeral: true });
    }

    const descricao = options.getString('descricao');
    const apagar = options.getBoolean('apagar') ?? false;
    const log = new Map();

    const updateProgress = async () => {
      const progressEmbed = new EmbedBuilder()
        .setTitle('⚡ Configurando o Servidor...')
        .setDescription(Array.from(log.values()).join('\n') || 'Aguardando início...')
        .setColor(0x5865F2)
        .setFooter({ text: 'Este processo pode levar alguns minutos.' });
      await safeReply(interaction, { embeds: [progressEmbed], ephemeral: true });
    };

    try {
      if (apagar) {
        log.set('clean', '🗑️ Apagando canais e cargos antigos...');
        await updateProgress();
        await limparServidor(guild, channelId);
        log.set('clean', '🗑️ Limpeza concluída.');
        await updateProgress();
      }

      log.set('ia', '🧠 Gerando configuração com IA...');
      await updateProgress();
      let config = await gerarConfigIA(descricao);
      if (!config || !config.channels || !config.roles) {
        log.set('ia', '⚠️ Falha na IA. Usando configuração padrão.');
        config = defaultConfig;
      } else {
        log.set('ia', '🧠 Configuração gerada pela IA com sucesso!');
      }
      await updateProgress();

      const stats = await aplicarConfiguracao(guild, config, log, updateProgress);

      await fs.writeFile(path.join(__dirname, 'ultimo_servidor.json'), JSON.stringify(config, null, 2));
      log.set('save', '💾 Configuração salva em `ultimo_servidor.json`.');

      const finalEmbed = new EmbedBuilder()
        .setTitle('✅ Configuração Concluída com Sucesso!')
        .setColor(0x00FF00)
        .setDescription('O seu servidor foi configurado.')
        .addFields(
          { name: 'Canais Criados', value: String(stats.createdChannelsCount), inline: true },
          { name: 'Cargos Criados', value: String(stats.createdRolesCount), inline: true },
          { name: 'Emojis Criados', value: String(stats.createdEmojisCount), inline: true }
        )
        .setFooter({ text: `Configuração baseada na descrição: "${descricao.substring(0, 100)}..."` });

      await safeReply(interaction, { embeds: [finalEmbed], ephemeral: true });

      await interaction.channel.send({ content: `🎉 O servidor foi reconfigurado por ${member.user.toString()}!` });

    } catch (error) {
      console.error('Erro global na execução do comando:', error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro Crítico')
        .setDescription(`Ocorreu um erro inesperado durante a configuração.\n\
${error.message}\
`)
        .setColor(0xFF0000);
      await safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }
  }
};