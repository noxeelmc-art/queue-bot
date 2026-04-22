const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

let queues = {};
let matches = {};
let playerStats = {};

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

const KIT_INFO = {
    'hydro': {
        name: '💧 Hydro',
        emoji: '💧',
        description: 'Fast water PvP',
        items: '• Water Bucket ×1\n• Diamond Sword ×1\n• Fishing Rod ×1\n• Blocks ×32\n• Golden Apples ×8\n• Lava Bucket ×1',
        focus: '👉 Focus: movement + clutch + knockback',
        rules: '• Water buckets allowed\n• No crystal PvP\n• Speed II effect active',
        difficulty: '⭐⭐⭐ Medium'
    },
    'smp': {
        name: '🌍 SMP',
        emoji: '🌍',
        description: 'Normal survival PvP',
        items: '• Diamond Sword ×1\n• Bow ×1\n• Arrows ×32\n• Water Bucket ×1\n• Steak ×32\n• Shield ×1\n• Golden Apples ×4',
        focus: '👉 Balanced, beginner-friendly',
        rules: '• Standard Minecraft PvP\n• All items allowed except crystal\n• No hacking or exploits',
        difficulty: '⭐⭐ Easy'
    },
    'diapot': {
        name: '💎 Diapot',
        emoji: '💎',
        description: 'Potion PvP',
        items: '• Diamond Sword ×1\n• Splash Healing Potions ×16\n• Ender Pearls ×4\n• Steak ×16\n• Speed Potion ×1',
        focus: '👉 Focus: healing timing',
        rules: '• Diamond armor only\n• All potions allowed\n• No strength II',
        difficulty: '⭐⭐⭐ Medium'
    },
    'noaxe': {
        name: '🪓 No Axe',
        emoji: '🪓',
        description: 'Sword-only PvP',
        items: '• Diamond Sword ×1\n• Fishing Rod ×1\n• Golden Apples ×6\n• Blocks ×32',
        focus: '👉 No shield breaking, combo-based',
        rules: '• Axes are BANNED\n• Swords only\n• No critical hits from axes',
        difficulty: '⭐⭐ Easy'
    },
    'axe': {
        name: '⚔️ Axe',
        emoji: '⚔️',
        description: 'Shield PvP',
        items: '• Diamond Axe ×1\n• Shield ×1\n• Golden Apples ×6\n• Steak ×16',
        focus: '👉 Timing > spam',
        rules: '• Axes primary weapon\n• Shield usage allowed\n• No swords',
        difficulty: '⭐⭐⭐⭐ Hard'
    },
    'uhc': {
        name: '🏹 UHC',
        emoji: '🏹',
        description: 'Survival hardcore PvP',
        items: '• Diamond Sword ×1\n• Bow ×1\n• Arrows ×64\n• Golden Apples ×3\n• Golden Heads ×2\n• Lava Bucket ×1\n• Water Bucket ×1\n• Blocks ×32',
        focus: '👉 Strategy + aim',
        rules: '• No natural regen\n• Golden apples give regen\n• Absorption hearts enabled',
        difficulty: '⭐⭐⭐⭐ Hard'
    },
    'elytramace': {
        name: '🦅 Elytra Mace',
        emoji: '🦅',
        description: 'Advanced aerial PvP',
        items: '• Elytra ×1\n• Fireworks ×16\n• Mace ×1\n• Golden Apples ×6',
        focus: '👉 Very high skill',
        rules: '• Elytra + Mace only\n• No swords or axes\n• Fall damage multiplier active',
        difficulty: '⭐⭐⭐⭐⭐ Very Hard'
    },
    'nethpot': {
        name: '🧪 NethPot',
        emoji: '🧪',
        description: 'Tank + potion PvP',
        items: '• Netherite Sword ×1\n• Splash Healing Potions ×20\n• Strength Potion ×1\n• Ender Pearls ×4',
        focus: '👉 Long fights',
        rules: '• All nether potions allowed\n• Strength II allowed\n• Instant damage pots banned',
        difficulty: '⭐⭐⭐⭐ Hard'
    },
    'crystal': {
        name: '💥 Crystal',
        emoji: '💥',
        description: 'End crystal PvP',
        items: '• End Crystals ×64\n• Obsidian ×64\n• Respawn Anchors ×2 (optional)\n• Glowstone ×16\n• Totem of Undying ×1\n• Netherite Sword ×1',
        focus: '👉 One mistake = death',
        rules: '• End crystals allowed\n• Obsidian placing allowed\n• Anchor PvP banned',
        difficulty: '⭐⭐⭐⭐⭐ Very Hard'
    },
    'spearmace': {
        name: '🔱 Spear Mace',
        emoji: '🔱',
        description: 'Hybrid combat',
        items: '• Trident ×1\n• Mace ×1\n• Water Bucket ×1\n• Golden Apples ×6\n• Blocks ×32',
        focus: '👉 Versatile fighting',
        rules: '• Tridents + Maces only\n• Loyalty tridents recommended\n• No swords',
        difficulty: '⭐⭐⭐⭐ Hard'
    }
};

// ==================== RANK SYSTEM ====================
const RANKS = [
    { name: 'LT5', emoji: '🪖', requiredWins: 0 },
    { name: 'LT4', emoji: '🪖', requiredWins: 3 },
    { name: 'LT3', emoji: '🪖', requiredWins: 7 },
    { name: 'LT2', emoji: '🪖', requiredWins: 12 },
    { name: 'LT1', emoji: '🪖', requiredWins: 18 },
    { name: 'HT5', emoji: '🎖️', requiredWins: 25 },
    { name: 'HT4', emoji: '🎖️', requiredWins: 33 },
    { name: 'HT3', emoji: '🎖️', requiredWins: 42 },
    { name: 'HT2', emoji: '🎖️', requiredWins: 52 },
    { name: 'HT1', emoji: '🎖️', requiredWins: 63 },
    { name: 'Combat Cadet', emoji: '⚔️', requiredWins: 75 },
    { name: 'Combat Grandmaster', emoji: '🏆', requiredWins: 100 }
];

function getRank(totalWins, kitWins = {}) {
    if (totalWins >= 100) {
        const allHT1 = GAMEMODES.every(kit => (kitWins[kit.value] || 0) >= 63);
        if (allHT1) return RANKS[RANKS.length-1];
    }
    for (let i = RANKS.length-1; i >= 0; i--) {
        if (totalWins >= RANKS[i].requiredWins) return RANKS[i];
    }
    return RANKS[0];
}

function getKitRank(wins) {
    if (wins >= 63) return 'HT1';
    if (wins >= 52) return 'HT2';
    if (wins >= 42) return 'HT3';
    if (wins >= 33) return 'HT4';
    if (wins >= 25) return 'HT5';
    if (wins >= 18) return 'LT1';
    if (wins >= 12) return 'LT2';
    if (wins >= 7) return 'LT3';
    if (wins >= 3) return 'LT4';
    return 'LT5';
}

function getNextRankInfo(currentRank, totalWins) {
    const idx = RANKS.findIndex(r => r.name === currentRank.name);
    if (idx === -1 || idx === RANKS.length-1) return null;
    const next = RANKS[idx+1];
    return { nextRank: next, winsNeeded: next.requiredWins - totalWins };
}

async function updatePlayerRank(member, userId, totalWins, kitWins) {
    const rank = getRank(totalWins, kitWins);
    const allRankNames = RANKS.map(r => r.name);
    for (const rn of allRankNames) {
        const oldRole = member.roles.cache.find(r => r.name === rn);
        if (oldRole) await member.roles.remove(oldRole).catch(()=>{});
    }
    const newRole = member.guild.roles.cache.find(r => r.name === rank.name);
    if (newRole) await member.roles.add(newRole).catch(()=>{});
    return rank;
}

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await registerCommands();
    await createRankRoles();
    console.log(`✅ ${GAMEMODES.length} gamemodes available`);
    console.log(`✅ Leaderboard ready with ${Object.keys(playerStats).length} players`);
});

async function createRankRoles() {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;
    for (const rank of RANKS) {
        if (!guild.roles.cache.find(r => r.name === rank.name)) {
            await guild.roles.create({ name: rank.name, color: rank.name.includes('HT') ? 0xFFA500 : 0x00FF00 }).catch(()=>{});
        }
    }
}

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
        },
        {
            name: 'kitinfo',
            description: 'Get detailed information about a specific kit',
            options: [{
                name: 'gamemode',
                description: 'Choose the gamemode to learn about',
                type: 3,
                required: true,
                choices: GAMEMODES
            }]
        },
        {
            name: 'kits',
            description: 'List all available kits with basic info'
        },
        {
            name: 'battlecard',
            description: 'View your personalized battle card'
        },
        {
            name: 'rank',
            description: 'Check your current rank and progression'
        },
        {
            name: 'region',
            description: 'Set your region for your battle card',
            options: [{
                name: 'region',
                description: 'Your region (NA, EU, ASIA, etc.)',
                type: 3,
                required: true
            }]
        },
        {
            name: 'addwins',
            description: '[STAFF] Add wins to a player (updates rank automatically)',
            options: [
                { name: 'player', type: 6, required: true, description: 'The player to give wins to' },
                { name: 'amount', type: 4, required: false, description: 'Number of wins to add (default 1)' },
                { name: 'kit', type: 3, required: false, description: 'Specific kit to add wins to', choices: GAMEMODES }
            ]
        },
        {
            name: 'forcewin',
            description: '[STAFF] Manually register a match result',
            options: [
                { name: 'winner', type: 6, required: true, description: 'The winning player' },
                { name: 'loser', type: 6, required: true, description: 'The losing player' },
                { name: 'gamemode', type: 3, required: true, description: 'The kit played', choices: GAMEMODES },
                { name: 'score', type: 3, required: true, description: 'Final score (e.g., 3-0)' }
            ]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commands registered');
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // /join command (unchanged)
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

    // /leave command (unchanged)
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

    // /queue command (unchanged)
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

    // /win command (unchanged)
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

    // /confirm command (updated with rank system)
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

        match.confirmed = true;
        
        const winner = match.winnerReporter;
        const loser = userId;
        const gamemode = match.gamemode;
        
        if (!playerStats[winner]) playerStats[winner] = { totalWins: 0, kitWins: {}, region: 'NA' };
        if (!playerStats[loser]) playerStats[loser] = { totalWins: 0, kitWins: {}, region: 'NA' };
        
        playerStats[winner].totalWins += 1;
        playerStats[winner].kitWins[gamemode] = (playerStats[winner].kitWins[gamemode] || 0) + 1;
        
        const winnerMember = await interaction.guild.members.fetch(winner);
        const newRank = await updatePlayerRank(winnerMember, winner, playerStats[winner].totalWins, playerStats[winner].kitWins);
        
        const nextRankInfo = getNextRankInfo(newRank, playerStats[winner].totalWins);
        let rankUpMsg = '';
        if (nextRankInfo) {
            rankUpMsg = `\n📈 **Next:** ${nextRankInfo.nextRank.emoji} ${nextRankInfo.nextRank.name} (${nextRankInfo.winsNeeded} more wins)`;
        } else if (newRank.name === 'Combat Grandmaster') {
            rankUpMsg = '\n👑 **MAX RANK ACHIEVED!** You are a legend!';
        }
        
        const winnerText = `🏆 **WINNER: <@${winner}>** (+1 win)\n🎖️ **New Rank:** ${newRank.emoji} ${newRank.name}${rankUpMsg}`;
        
        const resultsChannel = interaction.guild.channels.cache.find(c => c.name === '📋┃match-results');
        if (resultsChannel) {
            await resultsChannel.send({
                content: `🎉 **MATCH COMPLETE!** 🎉\n━━━━━━━━━━━━━━━━━━━━\n📦 **Gamemode:** ${match.gamemode}\n👥 **Battle:** <@${match.player1}> ⚔️ <@${match.player2}>\n📊 **Final Score:** ${match.pendingScore}\n${winnerText}\n✅ **Confirmed by both players**\n━━━━━━━━━━━━━━━━━━━━\n> GG WP! <@${winner}> shows great skill! 👏`
            });
        }
        
        await interaction.channel.send({
            content: `🎉 **GG! MATCH CONFIRMED!** 🎉\n━━━━━━━━━━━━━━━━━━━━\n📊 **Final Score:** ${match.pendingScore}\n${winnerText}\n━━━━━━━━━━━━━━━━━━━━\n> Well played both players! 💪\n🔒 This channel will close in **30 seconds**...`
        });
        
        await interaction.channel.permissionOverwrites.edit(match.player1, { SendMessages: false });
        await interaction.channel.permissionOverwrites.edit(match.player2, { SendMessages: false });
        
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

    // /leaderboard command (updated with ranks)
    if (interaction.commandName === 'leaderboard') {
        const page = interaction.options.getInteger('page') || 1;
        const itemsPerPage = 10;
        
        const sorted = Object.entries(playerStats)
            .sort((a, b) => b[1].totalWins - a[1].totalWins);
        
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
            let username = userId;
            try {
                const user = await client.users.fetch(userId);
                username = user.username;
            } catch(e) {}
            const playerRank = getRank(data.totalWins, data.kitWins);
            const medal = rank === 1 ? '👑 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
            message += `\n**${rank}.** ${medal}${username} — 🎯 **${data.totalWins}** wins | ${playerRank.emoji} ${playerRank.name}`;
            rank++;
        }
        
        message += `\n━━━━━━━━━━━━━━━━━━━━\n📌 Use \`/stats @player\` to see individual stats`;
        
        await interaction.reply({ content: message, ephemeral: true });
    }

    // /stats command (updated with rank and kit breakdown)
    if (interaction.commandName === 'stats') {
        const targetUser = interaction.options.getUser('player') || interaction.user;
        const userId = targetUser.id;
        
        const stats = playerStats[userId] || { totalWins: 0, kitWins: {}, region: 'NA' };
        const rank = getRank(stats.totalWins, stats.kitWins);
        const sorted = Object.entries(playerStats).sort((a, b) => b[1].totalWins - a[1].totalWins);
        const position = sorted.findIndex(([id]) => id === userId) + 1;
        
        const medalIcon = position === 1 ? '👑 ' : position === 2 ? '🥈 ' : position === 3 ? '🥉 ' : '';
        
        let kitBreak = '';
        for (const kit of GAMEMODES) {
            const wins = stats.kitWins[kit.value] || 0;
            kitBreak += `\n${KIT_INFO[kit.value].emoji} ${kit.name}: ${wins} wins (${getKitRank(wins)})`;
        }
        
        const embed = new EmbedBuilder()
            .setColor(rank.name.includes('HT') ? 0xFFA500 : 0x00FF00)
            .setTitle(`📊 ${targetUser.username}'S STATS`)
            .setDescription(`**${rank.emoji} ${rank.name}** (${stats.totalWins} points)\nRegion: ${stats.region || 'NA'}\nGlobal Rank: ${medalIcon}#${position || 'Unranked'}${position ? `/${sorted.length}` : ''}`)
            .addFields({ name: '📊 Kit Ranks', value: kitBreak || 'No wins yet' })
            .setFooter({ text: 'Keep grinding! 💪' });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /kitinfo command (unchanged)
    if (interaction.commandName === 'kitinfo') {
        const gamemode = interaction.options.getString('gamemode');
        const info = KIT_INFO[gamemode];
        
        if (!info) {
            return interaction.reply({ content: '❌ Kit info not found!', ephemeral: true });
        }
        
        const message = `**${info.emoji} ${info.name} KIT** ${info.emoji}\n━━━━━━━━━━━━━━━━━━━━\n📖 **Description:** ${info.description}\n━━━━━━━━━━━━━━━━━━━━\n🎒 **Items:**\n${info.items}\n━━━━━━━━━━━━━━━━━━━━\n🎯 **Focus:** ${info.focus}\n━━━━━━━━━━━━━━━━━━━━\n📜 **Rules:**\n${info.rules}\n━━━━━━━━━━━━━━━━━━━━\n📊 **Difficulty:** ${info.difficulty}\n━━━━━━━━━━━━━━━━━━━━\n⚡ Use \`/join gamemode:${gamemode}\` to queue!`;
        
        await interaction.reply({ content: message, ephemeral: false });
    }

    // /kits command (unchanged)
    if (interaction.commandName === 'kits') {
        let message = `**📚 AVAILABLE KITS** 📚\n━━━━━━━━━━━━━━━━━━━━\n`;
        
        for (const kit of GAMEMODES) {
            const info = KIT_INFO[kit.value];
            message += `\n**${info.emoji} ${info.name}**\n> ${info.description}\n> ${info.focus}\n> \`/kitinfo ${kit.value}\` | \`/join ${kit.value}\`\n`;
        }
        
        message += `\n━━━━━━━━━━━━━━━━━━━━\n📌 Use \`/kitinfo <gamemode>\` for detailed info!`;
        
        await interaction.reply({ content: message, ephemeral: false });
    }

    // ========== NEW COMMAND HANDLERS ==========
    
    // /battlecard (embed version, no canvas)
    if (interaction.commandName === 'battlecard') {
        const stats = playerStats[interaction.user.id] || { totalWins: 0, kitWins: {}, region: 'NA' };
        const rank = getRank(stats.totalWins, stats.kitWins);
        const sorted = Object.entries(playerStats).sort((a,b) => b[1].totalWins - a[1].totalWins);
        const position = sorted.findIndex(([id]) => id === interaction.user.id) + 1;
        
        let kitLine = '';
        for (const kit of GAMEMODES) {
            const wins = stats.kitWins[kit.value] || 0;
            kitLine += `${getKitRank(wins)} `;
        }
        
        const embed = new EmbedBuilder()
            .setColor(rank.name.includes('HT') ? 0xFFA500 : 0x00FF00)
            .setTitle(`${interaction.user.username}`)
            .setDescription(`**${rank.name} (${stats.totalWins} points)**\nRegion: ${stats.region || 'NA'}\n\n${kitLine.trim()}`)
            .setFooter({ text: `Global Rank #${position} out of ${sorted.length} • Use /region to change your region` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: false });
    }

    // /rank command
    if (interaction.commandName === 'rank') {
        const stats = playerStats[interaction.user.id] || { totalWins: 0, kitWins: {}, region: 'NA' };
        const rank = getRank(stats.totalWins, stats.kitWins);
        const next = getNextRankInfo(rank, stats.totalWins);
        let progress = '';
        if (next) {
            const curReq = RANKS.find(r => r.name === rank.name).requiredWins;
            const nextReq = next.nextRank.requiredWins;
            const have = stats.totalWins - curReq;
            const need = nextReq - curReq;
            const percent = Math.floor((have/need)*100);
            const bar = '█'.repeat(Math.floor(percent/10)) + '░'.repeat(10 - Math.floor(percent/10));
            progress = `\n📈 **Progress:** \`${bar}\` ${percent}%\n➜ ${next.winsNeeded} more wins to ${next.nextRank.name}`;
        } else {
            progress = '\n👑 **MAX RANK ACHIEVED!**';
        }
        await interaction.reply({ content: `🎖️ **Your Rank:** ${rank.emoji} ${rank.name}\n🏆 **Total Wins:** ${stats.totalWins}${progress}`, ephemeral: true });
    }

    // /region command
    if (interaction.commandName === 'region') {
        const region = interaction.options.getString('region').toUpperCase();
        if (!playerStats[interaction.user.id]) {
            playerStats[interaction.user.id] = { totalWins: 0, kitWins: {}, region: region };
        } else {
            playerStats[interaction.user.id].region = region;
        }
        await interaction.reply({ content: `✅ Region set to **${region}**`, ephemeral: true });
    }

    // /addwins - STAFF ONLY
    if (interaction.commandName === 'addwins') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ You need Administrator permission.', ephemeral: true });
        }
        const targetUser = interaction.options.getUser('player');
        const amount = interaction.options.getInteger('amount') || 1;
        const kit = interaction.options.getString('kit');
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: '❌ Amount must be between 1 and 100.', ephemeral: true });
        }
        if (!playerStats[targetUser.id]) {
            playerStats[targetUser.id] = { totalWins: 0, kitWins: {}, region: 'NA' };
        }
        playerStats[targetUser.id].totalWins += amount;
        if (kit) {
            playerStats[targetUser.id].kitWins[kit] = (playerStats[targetUser.id].kitWins[kit] || 0) + amount;
        }
        const member = await interaction.guild.members.fetch(targetUser.id);
        const newRank = await updatePlayerRank(member, targetUser.id, playerStats[targetUser.id].totalWins, playerStats[targetUser.id].kitWins);
        await interaction.reply({
            content: `✅ **Added ${amount} win(s) to ${targetUser.tag}**\n━━━━━━━━━━━━━━━━━━━━\n📊 **New total wins:** ${playerStats[targetUser.id].totalWins}\n🎖️ **New rank:** ${newRank.emoji} ${newRank.name}\n${kit ? `📦 **Kit:** ${kit} (+${amount})` : ''}`,
            ephemeral: false
        });
        const logChannel = interaction.guild.channels.cache.find(c => c.name === 'staff-logs');
        if (logChannel) logChannel.send(`🛠️ **${interaction.user.tag}** added ${amount} win(s) to ${targetUser.tag} (new rank: ${newRank.name})`);
    }

    // /forcewin - STAFF ONLY
    if (interaction.commandName === 'forcewin') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ You need Administrator permission.', ephemeral: true });
        }
        const winner = interaction.options.getUser('winner');
        const loser = interaction.options.getUser('loser');
        const gamemode = interaction.options.getString('gamemode');
        const score = interaction.options.getString('score');
        if (!/^\d+-\d+$/.test(score)) {
            return interaction.reply({ content: '❌ Invalid score format. Use e.g., 3-0', ephemeral: true });
        }
        if (!playerStats[winner.id]) playerStats[winner.id] = { totalWins: 0, kitWins: {}, region: 'NA' };
        if (!playerStats[loser.id]) playerStats[loser.id] = { totalWins: 0, kitWins: {}, region: 'NA' };
        playerStats[winner.id].totalWins += 1;
        playerStats[winner.id].kitWins[gamemode] = (playerStats[winner.id].kitWins[gamemode] || 0) + 1;
        const winnerMember = await interaction.guild.members.fetch(winner.id);
        const newRank = await updatePlayerRank(winnerMember, winner.id, playerStats[winner.id].totalWins, playerStats[winner.id].kitWins);
        await interaction.reply({
            content: `✅ **Match manually registered**\n━━━━━━━━━━━━━━━━━━━━\n📦 **Gamemode:** ${gamemode}\n👥 **Winner:** ${winner.tag}\n👤 **Loser:** ${loser.tag}\n📊 **Score:** ${score}\n🎖️ **${winner.tag}'s new rank:** ${newRank.emoji} ${newRank.name}`,
            ephemeral: false
        });
        const resultsChannel = interaction.guild.channels.cache.find(c => c.name === '📋┃match-results');
        if (resultsChannel) {
            await resultsChannel.send(`📝 **MANUAL REGISTRATION**\n━━━━━━━━━━━━━━━━━━━━\n📦 **Gamemode:** ${gamemode}\n👥 **Battle:** ${winner.tag} ⚔️ ${loser.tag}\n📊 **Score:** ${score}\n🏆 **Winner:** ${winner.tag} (+1 win)\n👮 **Registered by:** ${interaction.user.tag}`);
        }
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
    const kitInfo = KIT_INFO[gamemode];
    
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
        content: `🎮 **⚔️ MATCH STARTED! ⚔️**\n━━━━━━━━━━━━━━━━━━━━\n${kitInfo.emoji} **Gamemode:** ${kitInfo.name}\n👥 **Combatants:** <@${player1Id}> 🆚 <@${player2Id}>\n━━━━━━━━━━━━━━━━━━━━\n\n**📜 KIT INFO:**\n${kitInfo.focus}\n\n**🎒 ITEMS:**\n${kitInfo.items}\n━━━━━━━━━━━━━━━━━━━━\n\n**📜 HOW TO REPORT:**\n> 🏆 **WINNER:** Type \`/win 3-0\` (your score)\n> ❌ **LOSER:** Type \`/confirm\` to confirm your loss\n\n━━━━━━━━━━━━━━━━━━━━\n💬 **Chat here during the match!**\n⚡ **Good luck, have fun!** ⚡\n━━━━━━━━━━━━━━━━━━━━`
    });
    
    await channel.send(`🔔 <@${player1Id}> <@${player2Id}> - Fight! ⚔️`);
    
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
