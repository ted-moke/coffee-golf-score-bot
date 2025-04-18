import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getDailyScores, getRecentScores, getNYCTodayString, formatDate, getNYCTodayDate } from '../utils/storage';
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
        const scoringOption = interaction.options.getString('scoring');
        
        console.log(`Leaderboard command received from ${interaction.user.username}`);
        console.log(`Subcommand: ${subcommand}, Scoring option: ${scoringOption}`);

        // Send an initial response immediately
        await interaction.reply({ 
            content: "Fetching leaderboard data...", 
            ephemeral: false 
        });

        if (subcommand === 'today') {
            console.log('Fetching today\'s leaderboard');
            // If no scoring option is specified, show both first and best
            if (!scoringOption) {
                await showMultipleScoringTypes(interaction, [ScoringType.FIRST, ScoringType.BEST], getNYCTodayString());
            } else if (scoringOption === 'all') {
                await showMultipleScoringTypes(interaction, [ScoringType.FIRST, ScoringType.BEST, ScoringType.UNLIMITED], getNYCTodayString());
            } else {
                await showTodayLeaderboard(interaction, scoringOption);
            }
        } else if (subcommand === 'recent') {
            const days = interaction.options.getInteger('days') || 7;
            console.log(`Fetching recent leaderboard for ${days} days`);
            // If no scoring option is specified, show both first and best
            if (!scoringOption) {
                await showMultipleRecentScoringTypes(interaction, days, [ScoringType.FIRST, ScoringType.BEST]);
            } else if (scoringOption === 'all') {
                await showMultipleRecentScoringTypes(interaction, days, [ScoringType.FIRST, ScoringType.BEST, ScoringType.UNLIMITED]);
            } else {
                await showRecentLeaderboard(interaction, days, scoringOption);
            }
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
  // Check if we're dealing with avgStrokes or regular strokes
  const isAvgScore = 'avgStrokes' in scores[0];
  
  // Count tied players before this position
  const tiedPlayers = scores.filter((s, i) => {
    if (i >= index) return false; // Only count players before this position
    
    if (isAvgScore) {
      return Math.abs(s.avgStrokes - currentScore) < 0.001; // For floating point comparison
    } else {
      return s.strokes === currentScore; // For integer comparison
    }
  }).length;
  
  // If there are tied players, this player's position should be adjusted
  const actualPosition = index - tiedPlayers;
  
  // Check if this is part of a tie (including this player)
  const isPartOfTie = scores.filter(s => {
    if (isAvgScore) {
      return Math.abs(s.avgStrokes - currentScore) < 0.001;
    } else {
      return s.strokes === currentScore;
    }
  }).length > 1;
  
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
      
      // Calculate cumulative scores and average for each player
      const playerCumulativeScores = Object.entries(recentScores).map(([playerId, scores]) => {
        const totalStrokes = scores.reduce((sum, score) => sum + score.strokes, 0);
        const avgStrokes = scores.length > 0 ? totalStrokes / scores.length : 0;
        // Sort scores by date (oldest to newest)
        const sortedScores = [...scores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return {
          playerId,
          playerName: scores[0].playerName,
          totalStrokes,
          games: scores.length,
          avgStrokes,
          individualScores: sortedScores.map(s => s.strokes) // Store individual scores
        };
      });
      
      // Sort by average strokes (lowest first), then by total games (highest first) for tiebreakers
      const sortedPlayers = playerCumulativeScores
        .filter(player => player.games >= 1) // Require at least 1 game
        .sort((a, b) => {
          // First sort by average strokes
          if (a.avgStrokes !== b.avgStrokes) {
            return a.avgStrokes - b.avgStrokes;
          }
          // If tied on average, sort by more games played (reward consistency)
          return b.games - a.games;
        });
      
      // Get date range in NYC timezone
      const endDate = getNYCTodayDate();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days + 1); // +1 to include today
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`☕⛳ Coffee Golf Leaderboard - Last ${days} Days`)
        .setDescription(`**${getScoringTypeDisplay(scoringType)}**\n${formatDate(startDate)} to ${formatDate(endDate)}`)
        .setTimestamp();
      
      // Fixed player name length of 11 characters
      const nameLength = 11;
      
      // Create a table-like format using code block with monospaced font
      let leaderboardText = '```\n';
      leaderboardText += 'POS  PLAYER       AVG    ROUNDS TOTAL\n';
      leaderboardText += '─'.repeat(30) + '\n';
      
      sortedPlayers.forEach((player, index) => {
        const position = getPositionString(index, sortedPlayers, player.avgStrokes);
        // Truncate and pad the player name to exactly 11 characters
        const truncatedName = player.playerName.length > nameLength 
          ? player.playerName.substring(0, nameLength - 1) + '…' 
          : player.playerName;
        const paddedName = truncatedName.padEnd(nameLength);
        
        // Format individual scores with commas
        const scoresDisplay = player.individualScores.join(', ');
        
        leaderboardText += `${position.padEnd(4)} ${paddedName} ${player.avgStrokes.toFixed(1).padEnd(6)} ${scoresDisplay.padEnd(15)} ${player.totalStrokes}\n`;
      });
      
      leaderboardText += '```';
      
      embed.addFields({ name: 'Scores', value: leaderboardText || 'No scores yet' });
      
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error in showRecentLeaderboard:', error);
    throw error;
  }
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
      
      // Calculate cumulative scores and average for each player
      const playerCumulativeScores = Object.entries(recentScores).map(([playerId, scores]) => {
        const totalStrokes = scores.reduce((sum, score) => sum + score.strokes, 0);
        const avgStrokes = scores.length > 0 ? totalStrokes / scores.length : 0;
        // Sort scores by date (oldest to newest)
        const sortedScores = [...scores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return {
          playerId,
          playerName: scores[0].playerName,
          totalStrokes,
          games: scores.length,
          avgStrokes,
          individualScores: sortedScores.map(s => s.strokes) // Store individual scores
        };
      });
      
      // Sort by average strokes (lowest first), then by total games (highest first) for tiebreakers
      const sortedPlayers = playerCumulativeScores
        .filter(player => player.games >= 1) // Require at least 1 game
        .sort((a, b) => {
          // First sort by average strokes
          if (a.avgStrokes !== b.avgStrokes) {
            return a.avgStrokes - b.avgStrokes;
          }
          // If tied on average, sort by more games played (reward consistency)
          return b.games - a.games;
        });
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor(getScoringTypeColor(scoringType))
        .setTitle(`☕⛳ ${getScoringTypeDisplay(scoringType)}`)
        .setTimestamp();
      
      // Fixed player name length of 11 characters
      const nameLength = 11;
      
      // Create a table-like format using code block with monospaced font
      let leaderboardText = '```\n';
      leaderboardText += 'POS  PLAYER       AVG    ROUNDS       TOTAL\n';
      leaderboardText += '─'.repeat(45) + '\n';
      
      sortedPlayers.forEach((player, index) => {
        const position = getPositionString(index, sortedPlayers, player.avgStrokes);
        // Truncate and pad the player name to exactly 11 characters
        const truncatedName = player.playerName.length > nameLength 
          ? player.playerName.substring(0, nameLength - 1) + '…' 
          : player.playerName;
        const paddedName = truncatedName.padEnd(nameLength);
        
        // Format individual scores with commas
        const scoresDisplay = player.individualScores.join(', ');
        
        leaderboardText += `${position.padEnd(4)} ${paddedName} ${player.avgStrokes.toFixed(1).padEnd(6)} ${scoresDisplay.padEnd(15)} ${player.totalStrokes}\n`;
      });
      
      leaderboardText += '```';
      
      embed.addFields({ name: 'Scores', value: leaderboardText || 'No scores yet' });
      embeds.push(embed);
    } catch (error) {
      console.error(`Error generating leaderboard for ${scoringType}:`, error);
    }
  }
  
  if (embeds.length === 0) {
    await interaction.editReply(`No scores recorded in the last ${days} days!`);
    return;
  }
  
  // Get date range in NYC timezone
  const endDate = getNYCTodayDate();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1); // +1 to include today
  
  // Add master title embed
  const titleEmbed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`☕⛳ Coffee Golf Leaderboard - Last ${days} Days`)
    .setDescription(`**All Scoring Types**\n${formatDate(startDate)} to ${formatDate(endDate)}`)
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