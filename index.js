const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

let queues = {};
let matches = {}; // Store match info: { channelId: { player1, player2, gamemode, score, confirmed, winner } }

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
        },
        {
            name: 'score',
            description: 'Report match score (e.g., 3-0)',
            options: [{
                name: 'score',
                description: 'Your score (e.g., 3-0)',
                type: 3,
                required: true
            }]
        },
        {
            name: 'confirm',
            description: 'Confirm the reported score'
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

        if (!queues[gamemode]) queues[gamemode] = [];

        queues[gamemode].push(userId);
        const position = queues[gamemode].length;
        
        await interaction.reply({ 
            content: `✅ **${userName}** joined **${gamemode}** queue!\n📊 Position: ${position}\n⏳ Waiting for more players...`, 
            ephemeral: true 
        });

        while (queues[gamemode].length >= 2) {
            const player1 = queues[gamemode].shift();
            const player2 = queues[gamemode].shift();
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

    // /queue command
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

    // /score command
    if (interaction.commandName === 'score') {
        const channelId = interaction.channelId;
        const userId = interaction.user.id;
        const reportedScore = interaction.options.getString('score');

        if (!matches[channelId]) {
            return interaction.reply({ content: '❌ This is not a match channel!', ephemeral: true });
        }

        const match = matches[channelId];
        if (match.player1 !== userId && match.player2 !== userId) {
            return interaction.reply({ content: '❌ You are not in this match!', ephemeral: true });
        }

        if (match.confirmed) {
            return interaction.reply({ content: '❌ This match is already completed!', ephemeral: true });
        }

        // Validate score format (e.g., 3-0, 5-2)
        if (!/^\d+-\d+$/.test(reportedScore)) {
            return interaction.reply({ content: '❌ Invalid format! Use: `/score 3-0`', ephemeral: true });
        }

        match.pendingScore = reportedScore;
        match.scoreReporter = userId;
        
        await interaction.reply({ 
            content: `📝 **${interaction.user.username}** reported score: **${reportedScore}**\n⏳ Waiting for opponent to confirm with \`/confirm\``,
            ephemeral: false
        });
    }

    // /confirm command
    if (interaction.commandName === 'confirm') {
        const channelId = interaction.channelId;
        const userId = interaction.user.id;

        if (!matches[channelId]) {
            return interaction.reply({ content: '❌ This is not a match channel!', ephemeral: true });
        }

        const match = matches[channelId];
        
        if (match.confirmed) {
            return interaction.reply({ content: '❌ Match already completed!', ephemeral: true });
        }

        if (!match.pendingScore) {
            return interaction.reply({ content: '❌ No score reported yet! Use `/score` first.', ephemeral: true });
        }

        if (match.scoreReporter === userId) {
            return interaction.reply({ content: '❌ You reported the score! Waiting for opponent to confirm.', ephemeral: true });
        }

        if (match.player1 !== userId && match.player2 !== userId) {
            return interaction.reply({ content: '❌ You are not in this match!', ephemeral: true });
        }

        // Both confirmed! Lock the channel and post results
        match.confirmed = true;
        
        // Determine winner
        const [score1, score2] = match.pendingScore.split('-').map(Number);
        const reporterIsPlayer1 = match.scoreReporter === match.player1;
        const player1Score = reporterIsPlayer1 ? score1 : score2;
        const player2Score = reporterIsPlayer1 ? score2 : score1;
        
        let winner = null;
        if (player1Score > player2Score) winner = match.player1;
        else if (player2Score > player1Score) winner = match.player2;
        else winner = 'tie';
        
        const winnerText = winner === 'tie' ? '🤝 Tie!' : `🏆 Winner: <@${winner}>`;
        
        // Post to match-results channel
        const resultsChannel = interaction.guild.channels.cache.find(c => c.name === '📋┃match-results');
        if (resultsChannel) {
            await resultsChannel.send({
                content: `**🎮 Match Result**\n━━━━━━━━━━━━━━━━━━━━\n📦 **Gamemode:** ${match.gamemode}\n👥 **Players:** <@${match.player1}> vs <@${match.player2}>\n📊 **Score:** ${match.pendingScore}\n${winnerText}\n✅ **Confirmed by both players**\n━━━━━━━━━━━━━━━━━━━━`
            });
        }
        
        // Lock the channel
        await interaction.channel.send({
            content: `✅ **Match confirmed!**\n📊 Final Score: ${match.pendingScore}\n${winnerText}\n🔒 This channel is now locked and will be deleted in 30 seconds.`
        });
        
        // Update channel permissions to read-only
        await interaction.channel.permissionOverwrites.edit(match.player1, { SendMessages: false });
        await interaction.channel.permissionOverwrites.edit(match.player2, { SendMessages: false });
        
        // Delete channel after 30 seconds
        setTimeout(async () => {
            try {
                const channel = interaction.guild.channels.cache.get(channelId);
                if (channel) await channel.delete();
                delete matches[channelId];
            } catch (error) {
                console.error('Failed to delete channel:', error);
            }
        }, 30000);
        
        await interaction.reply({ content: '✅ Score confirmed! Channel will close in 30 seconds.', ephemeral: false });
    }
});

async function createMatchChannel(interaction, gamemode, player1Id, player2Id) {
    const guild = interaction.guild;
    
    let category = guild.channels.cache.find(c => c.name === 'MATCHES' && c.type === 4);
    if (!category) {
        category = await guild.channels.create({
            name: 'MATCHES',
            type: 4,
            permissionOverwrites: [
                { id: guild.id, deny: ['ViewChannel'] }
            ]
        });
    }
    
    const player1 = await guild.members.fetch(player1Id);
    const player2 = await guild.members.fetch(player2Id);
    
    const channelName = `${gamemode}-${player1.user.username}-vs-${player2.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);
    
    const channel = await guild.channels.create({
        name: channelName,
        type: 0,
        parent: category.id,
        permissionOverwrites: [
            { id: guild.id, deny: ['ViewChannel'] },
            { id: player1Id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
            { id: player2Id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] }
        ]
    });
    
    // Store match info
    matches[channel.id] = {
        player1: player1Id,
        player2: player2Id,
        gamemode: gamemode,
        confirmed: false,
        pendingScore: null,
        scoreReporter: null
    };
    
    await channel.send({
        content: `🎮 **Match Started!**\n━━━━━━━━━━━━━━━━━━━━\n📦 **Gamemode:** ${gamemode}\n👥 **Players:** <@${player1Id}> vs <@${player2Id}>\n━━━━━━━━━━━━━━━━━━━━\n\n**How to report score:**\n1️⃣ Type \`/score 3-0\` (example)\n2️⃣ Opponent types \`/confirm\`\n3️⃣ Results go to 📋┃match-results\n4️⃣ Channel auto-closes\n\nGood luck! 🎯`
    });
    
    await channel.send(`<@${player1Id}> <@${player2Id}>`);
    
    // Auto-delete after 12 hours if no score reported
    setTimeout(async () => {
        try {
            const existingChannel = guild.channels.cache.get(channel.id);
            if (existingChannel && !matches[channel.id]?.confirmed) {
                await existingChannel.send('⏰ Channel closing due to inactivity (12 hours).');
                setTimeout(() => existingChannel.delete().catch(console.error), 5000);
                delete matches[channel.id];
            }
        } catch (error) {
            console.error('Failed to delete channel:', error);
        }
    }, 12 * 60 * 60 * 1000);
    
    console.log(`✅ Match created: ${channel.name}`);
}

client.login(TOKEN);
