import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getDailyScores, getRecentScores, getNYCTodayString, formatDate } from '../utils/storage';
import { ScoringType } from '../types';
import { getScoringTypeFromString, getScoringTypeDisplay, getScoringTypeColor } from '../utils/scoring';

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
            { name: 'Best of 3 attempts', value: 'best' },
            { name: 'Best attempt (unlimited)', value: 'unlimited' },
            { name: 'All', value: 'all' }
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
            { name: 'Best of 3 attempts', value: 'best' },
            { name: 'Best attempt (unlimited)', value: 'unlimited' },
            { name: 'All', value: 'all' }
          )
      )
  );

// Execute command
export async function execute(interaction: ChatInputCommandInteraction) {
    // Don't defer the reply immediately, try to respond quickly first
    try {
        const subcommand = interaction.options.getSubcommand();
        const scoringOption = (interaction.options.getString('scoring') || 'first') as string;
        
        console.log(`Leaderboard command received from ${interaction.user.username}`);
        console.log(`Subcommand: ${subcommand}, Scoring option: ${scoringOption}`);

        // Send an initial response immediately
        await interaction.reply({ 
            content: "Fetching leaderboard data...", 
            ephemeral: false 
        });

        if (subcommand === 'today') {
            console.log('Fetching today\'s leaderboard');
            await showTodayLeaderboard(interaction, scoringOption);
        } else if (subcommand === 'recent') {
            const days = interaction.options.getInteger('days') || 7;
            console.log(`Fetching recent leaderboard for ${days} days`);
            await showRecentLeaderboard(interaction, days, scoringOption);
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

// Helper function to generate position string with ties
function getPositionString(index: number, scores: any[], currentScore: number): string {
  // Count how many players have the same score before this position
  const tiedPlayers = scores.filter((s, i) => i < index && s.strokes === currentScore).length;
  
  // If there are tied players, this player's position should be adjusted
  const actualPosition = index - tiedPlayers;
  
  // Check if this is part of a tie
  const isPartOfTie = scores.filter(s => s.strokes === currentScore).length > 1;
  
  if (isPartOfTie) {
    return actualPosition === 0 ? 'T-1' : `T-${actualPosition + 1}`;
  }
  
  // Return medal for top 3 non-tied positions, otherwise return number
  if (actualPosition === 0) return '🥇';
  if (actualPosition === 1) return '🥈';
  if (actualPosition === 2) return '🥉';
  return `${actualPosition + 1}.`;
}

// Show today's leaderboard
async function showTodayLeaderboard(interaction: ChatInputCommandInteraction, scoringOption: string): Promise<void> {
  // Use the interaction's creation timestamp to determine "today"
  const today = getNYCTodayString();
  
  if (scoringOption === 'all') {
    // Show all scoring types
    await showMultipleScoringTypes(interaction, [ScoringType.FIRST, ScoringType.BEST, ScoringType.UNLIMITED], today);
  } else {
    // Show single scoring type
    const scoringType = getScoringTypeFromString(scoringOption);
    const scores = await getDailyScores(today, scoringType);
    
    if (scores.length === 0) {
      await interaction.editReply(`No scores recorded for today (${today}) with ${getScoringTypeDisplay(scoringType)} scoring!`);
      return;
    }
    
    // Sort scores (lowest strokes first)
    const sortedScores = scores.sort((a, b) => a.strokes - b.strokes);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`☕⛳ Coffee Golf Leaderboard - Today (${today})`)
      .setDescription(`**${getScoringTypeDisplay(scoringType)}**`)
      .setTimestamp();
    
    // Add scores to embed
    let leaderboardText = '';
    sortedScores.forEach((score, index) => {
      const position = getPositionString(index, sortedScores, score.strokes);
      const emoji = getEmojiForPosition(index);
      leaderboardText += `${position} **${score.playerName}**: ${score.strokes} strokes ${score.route ? score.route : ''}\n`;
    });
    
    embed.addFields({ name: 'Scores', value: leaderboardText || 'No scores yet' });
    
    await interaction.editReply({ embeds: [embed] });
  }
}

// Show leaderboard for recent days
async function showRecentLeaderboard(interaction: ChatInputCommandInteraction, days: number, scoringOption: string): Promise<void> {
  try {
    if (scoringOption === 'all') {
      // Show all scoring types
      await showMultipleRecentScoringTypes(interaction, days, [ScoringType.FIRST, ScoringType.BEST, ScoringType.UNLIMITED]);
    } else {
      const scoringType = getScoringTypeFromString(scoringOption);
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
        .setDescription(`**${getScoringTypeDisplay(scoringType)}**\n${formatDate(new Date(Date.now() - days * 86400000))} to ${formatDate()}`)
        .setTimestamp();
      
      // Add scores to embed
      let leaderboardText = '';
      sortedPlayers.forEach((player, index) => {
        const position = getPositionString(index, sortedPlayers, player.totalStrokes);
        leaderboardText += `${position} **${player.playerName}**: ${player.totalStrokes} total strokes (${player.games} games)\n`;
      });
      
      embed.addFields({ name: 'Cumulative Scores', value: leaderboardText || 'No scores yet' });
      
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error in showRecentLeaderboard:', error);
    throw error;
  }
}

// Format date as "Month Day, Year"
function formatReadableDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// New function to display multiple scoring types for today
async function showMultipleScoringTypes(interaction: ChatInputCommandInteraction, scoringTypes: ScoringType[], date: string): Promise<void> {
  const embeds = [];
  
  for (const scoringType of scoringTypes) {
    const scores = await getDailyScores(date, scoringType);
    
    if (scores.length === 0) {
      continue; // Skip this scoring type if no scores
    }
    
    // Sort scores (lowest strokes first)
    const sortedScores = scores.sort((a, b) => a.strokes - b.strokes);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor(getScoringTypeColor(scoringType))
      .setTitle(`☕⛳ ${getScoringTypeDisplay(scoringType)}`)
      .setTimestamp();
    
    // Add scores to embed
    let leaderboardText = '';
    sortedScores.forEach((score, index) => {
      const position = getPositionString(index, sortedScores, score.strokes);
      leaderboardText += `${position} **${score.playerName}**: ${score.strokes} strokes ${score.route ? score.route : ''}\n`;
    });
    
    embed.addFields({ name: 'Scores', value: leaderboardText || 'No scores yet' });
    embeds.push(embed);
  }
  
  if (embeds.length === 0) {
    await interaction.editReply(`No scores recorded for today!`);
    return;
  }
  
  // Add master title embed
  const titleEmbed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`☕⛳ Coffee Golf Leaderboard - Today (${date})`)
    .setDescription(`**All Scoring Types**`)
    .setTimestamp();
  
  embeds.unshift(titleEmbed);
  
  await interaction.editReply({ embeds: embeds });
}

// New function to display multiple scoring types for recent days
async function showMultipleRecentScoringTypes(interaction: ChatInputCommandInteraction, days: number, scoringTypes: ScoringType[]): Promise<void> {
  const embeds = [];
  
  for (const scoringType of scoringTypes) {
    try {
      const recentScores = await getRecentScores(days, scoringType);
      
      if (Object.keys(recentScores).length === 0) {
        continue; // Skip this scoring type if no scores
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
        .setColor(getScoringTypeColor(scoringType))
        .setTitle(`☕⛳ ${getScoringTypeDisplay(scoringType)}`)
        .setTimestamp();
      
      // Add scores to embed
      let leaderboardText = '';
      sortedPlayers.forEach((player, index) => {
        const position = getPositionString(index, sortedPlayers, player.totalStrokes);
        leaderboardText += `${position} **${player.playerName}**: ${player.totalStrokes} total strokes (${player.games} games)\n`;
      });
      
      embed.addFields({ name: 'Cumulative Scores', value: leaderboardText || 'No scores yet' });
      embeds.push(embed);
    } catch (error) {
      console.error(`Error generating leaderboard for ${scoringType}:`, error);
    }
  }
  
  if (embeds.length === 0) {
    await interaction.editReply(`No scores recorded in the last ${days} days!`);
    return;
  }
  
  // Add master title embed
  const titleEmbed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`☕⛳ Coffee Golf Leaderboard - Last ${days} Days`)
    .setDescription(`**All Scoring Types**\n${formatDate(new Date(Date.now() - days * 86400000))} to ${formatDate()}`)
    .setTimestamp();
  
  embeds.unshift(titleEmbed);
  
  await interaction.editReply({ embeds: embeds });
}

// Helper function to get emoji for position
function getEmojiForPosition(index: number): string {
  switch (index) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return '';
  }
}