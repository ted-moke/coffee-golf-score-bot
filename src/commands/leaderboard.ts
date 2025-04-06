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

// Execute command logic
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  
  // Get scoring type option (default to 'first')
  const scoringTypeStr = interaction.options.getString('scoring') || 'first';
  const scoringType = scoringTypeStr === 'first' ? ScoringType.FIRST : ScoringType.BEST;
  
  if (subcommand === 'today') {
    await showTodayLeaderboard(interaction, scoringType);
  } else if (subcommand === 'recent') {
    const days = interaction.options.getInteger('days') || 7;
    await showRecentLeaderboard(interaction, days, scoringType);
  }
}

// Show today's leaderboard
async function showTodayLeaderboard(interaction: ChatInputCommandInteraction, scoringType: ScoringType): Promise<void> {
  const today = getTodayString();
  const scores = getDailyScores(today, scoringType);
  
  if (scores.length === 0) {
    await interaction.reply('No scores recorded for today yet!');
    return;
  }
  
  // Sort scores by strokes (lowest first)
  const sortedScores = [...scores].sort((a, b) => a.strokes - b.strokes);
  
  // Create embed
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`☕⛳ Coffee Golf Leaderboard - ${formatReadableDate(today)}`)
    .setDescription(`Today's top scores (${scoringType === ScoringType.FIRST ? 'First Attempt' : 'Best of 3 Attempts'})`)
    .setTimestamp();
  
  // Add scores to embed
  let leaderboardText = '';
  sortedScores.forEach((score, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    leaderboardText += `${medal} **${score.playerName}**: ${score.strokes} strokes ${score.route || ''}\n`;
  });
  
  embed.addFields({ name: 'Scores', value: leaderboardText || 'No scores yet' });
  
  await interaction.reply({ embeds: [embed] });
}

// Show leaderboard for recent days
async function showRecentLeaderboard(interaction: ChatInputCommandInteraction, days: number, scoringType: ScoringType): Promise<void> {
  const recentScores = getRecentScores(days, scoringType);
  
  if (Object.keys(recentScores).length === 0) {
    await interaction.reply(`No scores recorded in the last ${days} days!`);
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
    .setDescription(`Cumulative scores from ${formatReadableDate(new Date(Date.now() - days * 86400000))} to ${formatReadableDate(new Date())}`)
    .setTimestamp();
  
  // Add scores to embed
  let leaderboardText = '';
  sortedPlayers.forEach((player, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    leaderboardText += `${medal} **${player.playerName}**: ${player.totalStrokes} total strokes (${player.games} games)\n`;
  });
  
  embed.addFields({ name: 'Cumulative Scores', value: leaderboardText || 'No scores yet' });
  
  await interaction.reply({ embeds: [embed] });
}

// Format date as "Month Day, Year"
function formatReadableDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}