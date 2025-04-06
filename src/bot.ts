import { Client, Events, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { handleMessage } from './events/messageCreate';
import * as leaderboardCommand from './commands/leaderboard';

// Load environment variables
config();

// Check for required environment variables
if (!process.env.TOKEN) {
  throw new Error('Missing Discord bot token in .env file');
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Store commands
const commands = [leaderboardCommand];

// Handle ready event
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  registerCommands();
});

// Handle messages
client.on(Events.MessageCreate, handleMessage);

// Handle interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find(cmd => cmd.data.name === interaction.commandName);
  
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

// Register slash commands
async function registerCommands() {
  try {
    console.log('Started refreshing application commands.');

    const commandsData = commands.map(command => command.data.toJSON());
    
    const rest = new REST().setToken(process.env.TOKEN!);

    // Get the client ID from the bot user
    const clientId = client.user!.id;

    // Register global commands
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandsData },
    );

    console.log('Successfully reloaded application commands.');
  } catch (error) {
    console.error(error);
  }
}

// Function to start the bot
export function startBot() {
  // Login to Discord with the client token
  client.login(process.env.TOKEN);
}