const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

let queues = {};
let matches = {};
let leaderboard = {};

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
    console.log(`✅ Leaderboard ready with ${Object.keys(leaderboard).length} players`);
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
            name: 'win',
            description: 'Report that you won the match (winner uses this)',
            options: [{
                name: 'score',
                description: 'Your winning score (e.g., 3-0, 5-2)',
                type: 3,
                required: true
            }]
        },
        {
            name: 'confirm',
            description: 'Confirm that you lost the match (loser confirms)'
        },
        {
            name: 'leaderboard',
            description: 'View the top players by wins',
            options: [{
                name: 'page',
                description: 'Page number (1-10)',
                type: 4,
                required: false
            }]
        },
        {
            name: 'stats',
            description: 'View your or another player\'s stats',
            options: [{
                name: 'player',
                description: 'Player to view stats for (optional)',
                type: 6,
                required: false
            }]
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

    // /win command (winner reports)
    if (interaction.commandName === 'win') {
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

        if (match.pendingWin) {
            return interaction.reply({ content: '❌ A winner has already been reported! Waiting for confirmation.', ephemeral: true });
        }

        if (!/^\d+-\d+$/.test(reportedScore)) {
            return interaction.reply({ content: '❌ Invalid format! Use: `/win 3-0` (your winning score)', ephemeral: true });
        }

        match.pendingScore = reportedScore;
        match.winnerReporter = userId;
        match.pendingWin = true;
        
        const loser = match.player1 === userId ? match.player2 : match.player1;
        
        await interaction.reply({ 
            content: `🏆 **${interaction.user.username}** claims victory!\n📊 Score: **${reportedScore}**\n👤 Loser: <@${loser}>\n━━━━━━━━━━━━━━━━━━━━\n⚠️ **${match.player1 === userId ? '<@' + match.player2 + '>' : '<@' + match.player1 + '>'}**, if this is correct, type \`/confirm\` to confirm your loss.\n\n❌ If incorrect, contact staff.`,
            ephemeral: false
        });
    }

    // /confirm command (loser confirms)
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

        if (!match.pendingWin) {
            return interaction.reply({ content: '❌ No win reported yet! Winner must use `/win` first.', ephemeral: true });
        }

        if (match.winnerReporter === userId) {
            return interaction.reply({ content: '❌ You claimed the win! Waiting for opponent to confirm their loss.', ephemeral: true });
        }

        if (match.player1 !== userId && match.player2 !== userId) {
            return interaction.reply({ content: '❌ You are not in this match!', ephemeral: true });
        }

        // Loser confirmed - match is valid
        match.confirmed = true;
        
        const winner = match.winnerReporter;
        const loser = match.player1 === winner ? match.player2 : match.player1;
        
        // Update leaderboard
        if (!leaderboard[winner]) {
            leaderboard[winner] = { wins: 0, username: null };
        }
        leaderboard[winner].wins += 1;
        
        // Get usernames
        try {
            const winnerMember = await interaction.guild.members.fetch(winner);
            leaderboard[winner].username = winnerMember.user.username;
        } catch (e) {
            leaderboard[winner].username = winner;
        }
        
        const winnerText = `🏆 **WINNER: <@${winner}>** (+1 win)`;
        
        // Post to match-results channel with cool formatting
        const resultsChannel = interaction.guild.channels.cache.find(c => c.name === '📋┃match-results');
        if (resultsChannel) {
            await resultsChannel.send({
                content: `🎉 **MATCH COMPLETE!** 🎉\n━━━━━━━━━━━━━━━━━━━━\n📦 **Gamemode:** ${match.gamemode}\n👥 **Battle:** <@${match.player1}> ⚔️ <@${match.player2}>\n📊 **Final Score:** ${match.pendingScore}\n${winnerText}\n✅ **Confirmed by both players**\n━━━━━━━━━━━━━━━━━━━━\n> GG WP! <@${winner}> shows great skill! 👏`
            });
        }
        
        await interaction.channel.send({
            content: `🎉 **GG! MATCH CONFIRMED!** 🎉\n━━━━━━━━━━━━━━━━━━━━\n📊 **Final Score:** ${match.pendingScore}\n${winnerText}\n━━━━━━━━━━━━━━━━━━━━\n> Well played both players! 💪\n🔒 This channel will close in **30 seconds**...`
        });
        
        // Lock channel
        await interaction.channel.permissionOverwrites.edit(match.player1, { SendMessages: false });
        await interaction.channel.permissionOverwrites.edit(match.player2, { SendMessages: false });
        
        // Delete after 30 seconds
        setTimeout(async () => {
            try {
                const channel = interaction.guild.channels.cache.get(channelId);
                if (channel) await channel.delete();
                delete matches[channelId];
            } catch (error) {
                console.error('Failed to delete channel:', error);
            }
        }, 30000);
        
        await interaction.reply({ content: '✅ Loss confirmed! GG! Channel closing soon.', ephemeral: false });
    }

    // /leaderboard command
    if (interaction.commandName === 'leaderboard') {
        const page = interaction.options.getInteger('page') || 1;
        const itemsPerPage = 10;
        
        const sorted = Object.entries(leaderboard)
            .sort((a, b) => b[1].wins - a[1].wins);
        
        const totalPages = Math.ceil(sorted.length / itemsPerPage);
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageEntries = sorted.slice(start, end);
        
        if (pageEntries.length === 0) {
            return interaction.reply({ 
                content: '📭 No stats yet! Play some matches to appear on the leaderboard.', 
                ephemeral: true 
            });
        }
        
        let message = `**🏆 LEADERBOARD - Page ${page}/${totalPages}** 🏆\n━━━━━━━━━━━━━━━━━━━━\n`;
        let rank = start + 1;
        
        for (const [userId, data] of pageEntries) {
            const username = data.username || userId;
            const medal = rank === 1 ? '👑 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
            message += `\n**${rank}.** ${medal}${username} — 🎯 **${data.wins}** wins`;
            rank++;
        }
        
        message += `\n━━━━━━━━━━━━━━━━━━━━\n📌 Use \`/stats @player\` to see individual stats`;
        
        await interaction.reply({ content: message, ephemeral: true });
    }

    // /stats command
    if (interaction.commandName === 'stats') {
        const targetUser = interaction.options.getUser('player') || interaction.user;
        const userId = targetUser.id;
        
        const stats = leaderboard[userId] || { wins: 0 };
        const sorted = Object.entries(leaderboard).sort((a, b) => b[1].wins - a[1].wins);
        const rank = sorted.findIndex(([id]) => id === userId) + 1;
        
        const medalIcon = rank === 1 ? '👑 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
        
        const message = `**📊 ${targetUser.username}'S STATS** 📊\n━━━━━━━━━━━━━━━━━━━━\n🏆 **Wins:** ${stats.wins}\n🎯 **Rank:** ${medalIcon}${rank || 'Unranked'}${rank ? `/${sorted.length}` : ''}\n━━━━━━━━━━━━━━━━━━━━\n> Keep grinding! 💪`;
        
        await interaction.reply({ content: message, ephemeral: true });
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
    
    matches[channel.id] = {
        player1: player1Id,
        player2: player2Id,
        gamemode: gamemode,
        confirmed: false,
        pendingScore: null,
        winnerReporter: null,
        pendingWin: false
    };
    
    await channel.send({
        content: `🎮 **⚔️ MATCH STARTED! ⚔️**\n━━━━━━━━━━━━━━━━━━━━\n📦 **Gamemode:** ${gamemode}\n👥 **Combatants:** <@${player1Id}> 🆚 <@${player2Id}>\n━━━━━━━━━━━━━━━━━━━━\n\n**📜 HOW TO REPORT:**\n> 🏆 **WINNER:** Type \`/win 3-0\` (your score)\n> ❌ **LOSER:** Type \`/confirm\` to confirm your loss\n\n━━━━━━━━━━━━━━━━━━━━\n💬 **Chat here during the match!**\n⚡ **Good luck, have fun!** ⚡\n━━━━━━━━━━━━━━━━━━━━`
    });
    
    await channel.send(`🔔 <@${player1Id}> <@${player2Id}> - Fight! ⚔️`);
    
    // Auto-delete after 12 hours
    setTimeout(async () => {
        try {
            const existingChannel = guild.channels.cache.get(channel.id);
            if (existingChannel && !matches[channel.id]?.confirmed) {
                await existingChannel.send('⏰ **Channel closing due to inactivity (12 hours).**');
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
