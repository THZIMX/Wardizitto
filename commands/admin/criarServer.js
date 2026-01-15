const { 
  SlashCommandBuilder, 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  MessageFlags,
  Colors
} = require('discord.js');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const groqApiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// --- Funções Auxiliares ---

function getPermissionBit(permName) {
  return PermissionFlagsBits[permName] || null;
}

async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.editReply(options);
    }
    return await interaction.reply(options);
  } catch (error) {
    console.error('[SafeReply Error]:', error.message);
  }
}

async function gerarConfigIA(descricao) {
  if (!groqApiKey) throw new Error('GROQ_API_KEY não configurada.');

  const systemPrompt = `Você é um Arquiteto de Servidores Discord. 
Responda APENAS com um objeto JSON válido. 
Não inclua explicações ou blocos de código markdown.
O JSON deve seguir esta estrutura:
{
  "roles": [{ "name": "Admin", "color": "#FF0000", "permissions": ["Administrator"] }],
  "categories": [{ "name": "GERAL", "channels": [{ "name": "chat", "type": "text" }] }]
}`;

  const userPrompt = `Gere um servidor para: "${descricao}"`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Groq Error Detail:', data);
      throw new Error(`Groq API Error: ${response.status}`);
    }

    let content = data.choices[0].message.content.trim();
    // Limpeza de markdown caso a IA ignore o comando de não usar
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(content);
  } catch (error) {
    console.error('[IA Error]:', error);
    return null;
  }
}

/**
 * Limpa o servidor com segurança.
 * CORREÇÃO: Ignora erros de canais já deletados e protege o canal da interação.
 */
async function limparServidor(guild, preservedChannelId) {
  const channels = await guild.channels.fetch();
  for (const [, channel] of channels) {
    // Nunca deleta o canal onde o comando foi usado para evitar erro de "Unknown Channel"
    if (channel.id !== preservedChannelId && channel.deletable) {
      try {
        await channel.delete();
        await delay(300);
      } catch (e) {
        console.warn(`Não foi possível deletar canal ${channel.name}`);
      }
    }
  }

  const roles = await guild.roles.fetch();
  for (const [, role] of roles) {
    if (role.editable && !role.managed && role.id !== guild.roles.everyone.id) {
      try {
        await role.delete();
        await delay(300);
      } catch (e) {
        console.warn(`Não foi possível deletar cargo ${role.name}`);
      }
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-servidor')
    .setDescription('Cria um servidor completo usando IA.')
    .addStringOption(opt => opt.setName('descricao').setDescription('Descrição do servidor').setRequired(true))
    .addBooleanOption(opt => opt.setName('limpar').setDescription('Apagar tudo antes?'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const { guild, options, channelId } = interaction;
    
    // Usamos ephemeral para garantir que a resposta sobreviva à limpeza de canais
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const descricao = options.getString('descricao');
    const deveLimpar = options.getBoolean('limpar') || false;
    const log = [];

    const updateStatus = async (msg, color = Colors.Blue) => {
      log.push(msg);
      if (log.length > 8) log.shift();
      const embed = new EmbedBuilder()
        .setTitle('🏗️ Construindo Servidor')
        .setDescription(log.join('\n'))
        .setColor(color);
      await safeReply(interaction, { embeds: [embed] });
    };

    try {
      if (deveLimpar) {
        await updateStatus('⚠️ Limpando canais e cargos...', Colors.Orange);
        await limparServidor(guild, channelId);
        await updateStatus('✅ Limpeza concluída.');
      }

      await updateStatus('🧠 Consultando IA (Groq)...');
      const config = await gerarConfigIA(descricao);
      
      if (!config) {
        throw new Error('A IA falhou ao gerar o JSON. Verifique sua chave ou modelo no .env.');
      }

      await updateStatus('✨ Projeto recebido! Criando estrutura...');

      if (config.roles) {
        for (const r of config.roles) {
          await guild.roles.create({
            name: r.name,
            color: r.color || Colors.Default,
            permissions: (r.permissions || []).map(getPermissionBit).filter(Boolean)
          }).catch(() => {});
          await delay(400);
        }
      }

      if (config.categories) {
        for (const cat of config.categories) {
          const category = await guild.channels.create({
            name: cat.name,
            type: ChannelType.GuildCategory
          }).catch(() => null);

          if (category && cat.channels) {
            for (const ch of cat.channels) {
              await guild.channels.create({
                name: ch.name,
                type: ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
                parent: category.id
              }).catch(() => {});
              await delay(400);
            }
          }
        }
      }

      const finalEmbed = new EmbedBuilder()
        .setTitle('✅ Servidor Pronto!')
        .setDescription(`A estrutura para **${descricao}** foi criada com sucesso.`)
        .setColor(Colors.Green);

      await safeReply(interaction, { embeds: [finalEmbed] });

    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setDescription(error.message)
        .setColor(Colors.Red);
      await safeReply(interaction, { embeds: [errorEmbed] });
    }
  }
};
