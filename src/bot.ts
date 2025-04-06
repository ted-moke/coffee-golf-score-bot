import { Client, Events, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { handleMessage } from './events/messageCreate';
import * as leaderboardCommand from './commands/leaderboard';

// Load environment variables
config();

// Store commands
const commands = [leaderboardCommand];

// Create the client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Register slash commands
async function registerCommands() {
  try {
    console.log('Started refreshing application commands.');

    const commandsData = commands.map(command => command.data.toJSON());
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('No Discord token provided');
    }

    const rest = new REST().setToken(token);

    // Get the client ID from the bot user
    const clientId = client.user!.id;

    // Register global commands
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandsData },
    );

    console.log('Successfully reloaded application commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Handle ready event
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  console.log(`Watching channel ID: ${process.env.CHANNEL_ID}`);
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

// Function to start the bot
export async function startBot() {
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('No Discord token provided');
    }
    
    // Debug token format (don't log the actual token)
    console.log('Token length:', token.length);
    console.log('Token starts with:', token.substring(0, 10) + '...');
    
    await client.login(token);
    console.log('Bot successfully logged in!');
    return client;
  } catch (error) {
    console.error('Failed to start bot:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
    }
    throw error;
  }
}