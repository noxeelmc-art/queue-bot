const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

let queues = {};

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await registerCommands();
});

async function registerCommands() {
    const commands = [
        {
            name: 'join',
            description: 'Join the queue for a kit',
            options: [{
                name: 'kit',
                description: 'The kit you want to play',
                type: 3,
                required: true
            }]
        },
        {
            name: 'leave',
            description: 'Leave the current queue'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commands registered');
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'join') {
        const kit = interaction.options.getString('kit');
        const userId = interaction.user.id;

        let alreadyIn = false;
        for (let k in queues) {
            if (queues[k] && queues[k].includes(userId)) {
                alreadyIn = true;
                break;
            }
        }

        if (alreadyIn) {
            return interaction.reply({ content: '❌ You are already in a queue! Use `/leave` first.', ephemeral: true });
        }

        if (!queues[kit]) queues[kit] = [];

        queues[kit].push(userId);

        if (queues[kit].length >= 2) {
            const player1 = queues[kit].shift();
            const player2 = queues[kit].shift();

            const category = interaction.guild.channels.cache.find(c => c.name === 'MATCHES' && c.type === 4);
            const channel = await interaction.guild.channels.create({
                name: `match-${kit}-${player1.slice(-4)}`,
                type: 0,
                parent: category,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: ['ViewChannel'] },
                    { id: player1, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                    { id: player2, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
                ]
            });

            await channel.send(`🎮 **Match Started!**\nKit: ${kit}\n<@${player1}> vs <@${player2}>\nGood luck!`);
            await interaction.reply({ content: `✅ Match found! Check ${channel}`, ephemeral: true });
        } else {
            await interaction.reply({ content: `✅ Joined **${kit}** queue. Waiting for 1 more... (${queues[kit].length}/2)`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'leave') {
        const userId = interaction.user.id;
        let removed = false;

        for (let kit in queues) {
            const index = queues[kit].indexOf(userId);
            if (index !== -1) {
                queues[kit].splice(index, 1);
                removed = true;
                break;
            }
        }

        await interaction.reply({ content: removed ? '✅ Left queue.' : '❌ Not in any queue.', ephemeral: true });
    }
});

client.login(TOKEN);