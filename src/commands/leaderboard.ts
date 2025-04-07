import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getDailyScores, getRecentScores, getTodayString, formatDate } from '../utils/storage';
import { ScoringType } from '../types';

// Create slash command builder
export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Shows Coffee Golf leaderboards')
  .addSubcommand(subcommand =>
    subcommand
      .setName('today')
      .setDescription('Show today\'s leaderboard')
      .addStringOption(option => 
        option
          .setName('scoring')
          .setDescription('Scoring type to use')
          .setRequired(false)
          .addChoices(
            { name: 'First attempt', value: 'first' },
            { name: 'Best of 3 attempts', value: 'best' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('recent')
      .setDescription('Show leaderboard for recent days')
      .addIntegerOption(option =>
        option
          .setName('days')
          .setDescription('Number of days to include')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(30)
      )
      .addStringOption(option => 
        option
          .setName('scoring')
          .setDescription('Scoring type to use')
          .setRequired(false)
          .addChoices(
            { name: 'First attempt', value: 'first' },
            { name: 'Best of 3 attempts', value: 'best' }
          )
      )
  );

// Execute command
export async function execute(interaction: ChatInputCommandInteraction) {
    // Don't defer the reply immediately, try to respond quickly first
    try {
        const subcommand = interaction.options.getSubcommand();
        const scoringType = (interaction.options.getString('scoring') || 'first') as ScoringType;
        
        console.log(`Leaderboard command received from ${interaction.user.username}`);
        console.log(`Subcommand: ${subcommand}, Scoring type: ${scoringType}`);

        // Send an initial response immediately
        await interaction.reply({ 
            content: "Fetching leaderboard data...", 
            ephemeral: false 
        });

        if (subcommand === 'today') {
            console.log('Fetching today\'s leaderboard');
            await showTodayLeaderboard(interaction, scoringType);
        } else if (subcommand === 'recent') {
            const days = interaction.options.getInteger('days') || 7;
            console.log(`Fetching recent leaderboard for ${days} days`);
            await showRecentLeaderboard(interaction, days, scoringType);
        }
    } catch (error) {
        console.error('Error executing leaderboard command:', error);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'There was an error while fetching the leaderboard!',
                    ephemeral: true
                });
            } else {
                await interaction.editReply('There was an error while fetching the leaderboard!');
            }
        } catch (followUpError) {
            console.error('Error sending error response:', followUpError);
        }
    }
}

// Show today's leaderboard
async function showTodayLeaderboard(interaction: ChatInputCommandInteraction, scoringType: ScoringType): Promise<void> {
  try {
    const today = getTodayString();
    console.log('Getting scores for date:', today);
    
    const scores = await getDailyScores(today, scoringType);
    console.log(`Found ${scores.length} scores for today`);

    if (scores.length === 0) {
      await interaction.editReply('No scores recorded today!');
      return;
    }
    
    // Sort scores by strokes (lowest first)
    const sortedScores = scores.sort((a, b) => a.strokes - b.strokes);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('☕⛳ Coffee Golf Leaderboard - Today')
      .setDescription(`Showing ${scoringType} scores for ${formatDate()}`)
      .setTimestamp();
    
    // Add scores to embed
    let leaderboardText = '';
    sortedScores.forEach((score, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      leaderboardText += `${medal} **${score.playerName}**: ${score.strokes} strokes ${score.route || ''}\n`;
    });
    
    embed.addFields({ name: 'Scores', value: leaderboardText || 'No scores yet' });
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in showTodayLeaderboard:', error);
    throw error; // Let the main error handler deal with it
  }
}

// Show leaderboard for recent days
async function showRecentLeaderboard(interaction: ChatInputCommandInteraction, days: number, scoringType: ScoringType): Promise<void> {
  try {
    const recentScores = await getRecentScores(days, scoringType);
    console.log(`Found scores for ${Object.keys(recentScores).length} players in the last ${days} days`);
    
    if (Object.keys(recentScores).length === 0) {
      await interaction.editReply(`No scores recorded in the last ${days} days!`);
      return;
    }
    
    // Calculate cumulative scores for each player
    const playerCumulativeScores = Object.entries(recentScores).map(([playerId, scores]) => {
      const totalStrokes = scores.reduce((sum, score) => sum + score.strokes, 0);
      return {
        playerId,
        playerName: scores[0].playerName,
        totalStrokes,
        games: scores.length
      };
    });
    
    // Sort by total strokes (lowest first)
    const sortedPlayers = playerCumulativeScores.sort((a, b) => a.totalStrokes - b.totalStrokes);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`☕⛳ Coffee Golf Leaderboard - Last ${days} Days`)
      .setDescription(`Cumulative scores from ${formatDate(new Date(Date.now() - days * 86400000))} to ${formatDate()}`)
      .setTimestamp();
    
    // Add scores to embed
    let leaderboardText = '';
    sortedPlayers.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      leaderboardText += `${medal} **${player.playerName}**: ${player.totalStrokes} total strokes (${player.games} games)\n`;
    });
    
    embed.addFields({ name: 'Cumulative Scores', value: leaderboardText || 'No scores yet' });
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in showRecentLeaderboard:', error);
    throw error; // Let the main error handler deal with it
  }
}

// Format date as "Month Day, Year"
function formatReadableDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}