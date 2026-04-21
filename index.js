const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Queue storage: { "gamemode": ["user1", "user2", "user3"] }
let queues = {};

// Store which channel belongs to which players
let matchChannels = {};

const GAMEMODES = [
    { name: '💧 Hydro', value: 'hydro' },
    { name: '🌍 SMP', value: 'smp' },
    { name: '💎 Diapot', value: 'diapot' },
    { name: '🪓 No Axe', value: 'noaxe' },
    { name: '⚔️ Axe', value: 'axe' },
    { name: '🏹 UHC', value: 'uhc' },
    { name: '🦅 Elytra Mace', value: 'elytramace' },
    { name: '🧪 NethPot', value: 'nethpot' },
    { name: '💥 Crystal', value: 'crystal' },
    { name: '🔱 Spear Mace', value: 'spearmace' }
];

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await registerCommands();
    console.log(`✅ ${GAMEMODES.length} gamemodes available`);
});

async function registerCommands() {
    const commands = [
        {
            name: 'join',
            description: 'Join the queue for a gamemode',
            options: [{
                name: 'gamemode',
                description: 'Choose your gamemode',
                type: 3,
                required: true,
                choices: GAMEMODES
            }]
        },
        {
            name: 'leave',
            description: 'Leave the current queue'
        },
        {
            name: 'queue',
            description: 'Check who is waiting in each queue'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commands registered');
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // /join command
    if (interaction.commandName === 'join') {
        const gamemode = interaction.options.getString('gamemode');
        const userId = interaction.user.id;
        const userName = interaction.user.username;

        // Check if already in any queue
        let alreadyIn = false;
        let currentGamemode = null;
        for (let gm in queues) {
            if (queues[gm] && queues[gm].includes(userId)) {
                alreadyIn = true;
                currentGamemode = gm;
                break;
            }
        }

        if (alreadyIn) {
            return interaction.reply({ 
                content: `❌ You are already in **${currentGamemode}** queue! Use \`/leave\` first.`, 
                ephemeral: true 
            });
        }

        // Initialize queue for this gamemode
        if (!queues[gamemode]) queues[gamemode] = [];

        // Add to queue
        queues[gamemode].push(userId);
        
        const position = queues[gamemode].length;
        
        await interaction.reply({ 
            content: `✅ **${userName}** joined **${gamemode}** queue!\n📊 Position: ${position}\n⏳ Waiting for more players...`, 
            ephemeral: true 
        });

        // Check for matches (pair up players in groups of 2)
        while (queues[gamemode].length >= 2) {
            const player1 = queues[gamemode].shift();
            const player2 = queues[gamemode].shift();
            
            // Create private ticket channel
            await createMatchChannel(interaction, gamemode, player1, player2);
        }
    }

    // /leave command
    if (interaction.commandName === 'leave') {
        const userId = interaction.user.id;
        let removed = false;
        let removedFrom = null;

        for (let gamemode in queues) {
            const index = queues[gamemode].indexOf(userId);
            if (index !== -1) {
                queues[gamemode].splice(index, 1);
                removed = true;
                removedFrom = gamemode;
                break;
            }
        }

        await interaction.reply({ 
            content: removed ? `✅ Left **${removedFrom}** queue.` : '❌ You are not in any queue.', 
            ephemeral: true 
        });
    }

    // /queue command - show all queues
    if (interaction.commandName === 'queue') {
        let message = '**📋 Current Queues:**\n';
        let hasPlayers = false;
        
        for (let gamemode in queues) {
            if (queues[gamemode] && queues[gamemode].length > 0) {
                hasPlayers = true;
                const players = queues[gamemode].map(id => `<@${id}>`).join(', ');
                message += `\n**${gamemode}** (${queues[gamemode].length}): ${players}`;
            }
        }
        
        if (!hasPlayers) {
            message = '📭 No one is currently in any queue. Use `/join` to start!';
        }
        
        await interaction.reply({ content: message, ephemeral: true });
    }
});

async function createMatchChannel(interaction, gamemode, player1Id, player2Id) {
    const guild = interaction.guild;
    
    // Find or create a "Matches" category
    let category = guild.channels.cache.find(c => c.name === 'MATCHES' && c.type === 4);
    if (!category) {
        category = await guild.channels.create({
            name: 'MATCHES',
            type: 4, // Category
            permissionOverwrites: [
                { id: guild.id, deny: ['ViewChannel'] }
            ]
        });
    }
    
    // Get player names
    const player1 = await guild.members.fetch(player1Id);
    const player2 = await guild.members.fetch(player2Id);
    
    // Create private channel
    const channelName = `${gamemode}-${player1.user.username}-vs-${player2.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);
    
    const channel = await guild.channels.create({
        name: channelName,
        type: 0, // Text channel
        parent: category.id,
        permissionOverwrites: [
            { id: guild.id, deny: ['ViewChannel'] },
            { id: player1Id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
            { id: player2Id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] }
        ]
    });
    
    // Store match info
    matchChannels[channel.id] = { player1: player1Id, player2: player2Id, gamemode: gamemode };
    
    // Send welcome message
    await channel.send({
        content: `🎮 **Match Started!**\n━━━━━━━━━━━━━━━━━━━━\n📦 **Gamemode:** ${gamemode}\n👥 **Players:** <@${player1Id}> vs <@${player2Id}>\n━━━━━━━━━━━━━━━━━━━━\n💬 You can chat here to discuss the match!\n⏰ This channel will auto-close in 12 hours if inactive.\n\n**Good luck and have fun!** 🎯`
    });
    
    // Notify both players
    await channel.send(`<@${player1Id}> <@${player2Id}>`);
    
    // Auto-delete channel after 12 hours
    setTimeout(async () => {
        try {
            const existingChannel = guild.channels.cache.get(channel.id);
            if (existingChannel) {
                await existingChannel.send('⏰ This channel is closing due to inactivity (12 hours).');
                setTimeout(() => existingChannel.delete().catch(console.error), 5000);
            }
        } catch (error) {
            console.error('Failed to delete channel:', error);
        }
    }, 12 * 60 * 60 * 1000); // 12 hours
    
    console.log(`✅ Match created: ${channel.name} for ${gamemode}`);
}

client.login(TOKEN);
