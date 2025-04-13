import { Message } from 'discord.js';
import { parseScoreMessage } from '../utils/scoreParser';
import { addScore, getPlayerAttemptsToday, getDailyScores } from '../utils/storage';
import { Score, ScoringType } from '../types';

// Maximum attempts allowed per day
const MAX_ATTEMPTS = 3;

// Process incoming messages
export async function handleMessage(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only process messages from the target channel
  // Trim any whitespace from the channel ID
  const targetChannelId = process.env.CHANNEL_ID?.trim();
  if (message.channelId !== targetChannelId) {
    return;
  }

  const messageDate = new Date(message.createdAt);
  
  console.log(`Message received in target channel from ${message.author.username}: "${message.content}"`);
  
  // Try to parse the message as a score submission
  const scoreData = parseScoreMessage(message);
  
  if (scoreData) {
    console.log(`Parsed score data:`, JSON.stringify(scoreData, null, 2));
    
    // Check attempts
    const currentAttempts = await getPlayerAttemptsToday(scoreData.playerId, messageDate);
    console.log(`Current attempts for ${scoreData.playerName}: ${currentAttempts}`);
    
    if (currentAttempts >= MAX_ATTEMPTS) {
      // Player has reached max attempts for today
      try {
        await message.react('❌');
        await message.reply(`You've already used all ${MAX_ATTEMPTS} attempts for today. This score won't be counted.`);
      } catch (error) {
        console.error('Error adding reaction:', error);
      }
      return;
    }
    
    // Save score
    const { isFirst, attemptNumber } = await addScore(scoreData);
    console.log(`Score saved for ${scoreData.playerName}: attempt ${attemptNumber}, isFirst: ${isFirst}`);
    
    try {
      // Check if this is the best score across different scoring types
      await checkTopScoreAndReact(message, scoreData);
      
      console.log(`Recorded score for ${scoreData.playerName}: ${scoreData.strokes} strokes (Attempt ${attemptNumber}/${MAX_ATTEMPTS})`);
    } catch (error) {
      console.error('Error handling score message:', error);
    }
  }
}

// Helper function to check if score is top in different categories and add reactions
async function checkTopScoreAndReact(message: Message, scoreData: Score): Promise<void> {
  const date = scoreData.date;
  
  // Get player's attempts for today to determine which scoring types apply
  const playerAttempts = await getPlayerAttemptsToday(scoreData.playerId);
  const attemptNumber = playerAttempts; // This is the current attempt number
  
  console.log(`Player ${scoreData.playerName} attempt #${attemptNumber} with score ${scoreData.strokes}`);
  
  // Check for first attempt scores (ScoringType.FIRST)
  const firstScores = await getDailyScores(date, ScoringType.FIRST);
  const lowestFirstScore = Math.min(...firstScores.map(s => s.strokes)) || Infinity;
  
  // Check for best of 3 scores (ScoringType.BEST)
  const bestOfThreeScores = await getDailyScores(date, ScoringType.BEST);
  const lowestBestOfThreeScore = Math.min(...bestOfThreeScores.map(s => s.strokes)) || Infinity;
  
  // Check for unlimited scores (ScoringType.UNLIMITED)
  const unlimitedScores = await getDailyScores(date, ScoringType.UNLIMITED);
  const lowestUnlimitedScore = Math.min(...unlimitedScores.map(s => s.strokes)) || Infinity;
  
  // Add reactions based on which categories this score is STRICTLY better in
  let topCategories = [];
  
  // Check if it's the best first attempt (only if this is their first attempt)
  if (attemptNumber === 1 && scoreData.strokes < lowestFirstScore) {
    await message.react('🏆');
    await message.react('☝🏽');
    topCategories.push("first attempt");
  }
  
  // Check if it's the best of 3 (only if this is within their first 3 attempts)
  if (attemptNumber <= 3 && scoreData.strokes < lowestBestOfThreeScore) {
    // Only add trophy if we didn't already add it for first attempt
    if (topCategories.length === 0) {
      await message.react('🏆');
    }
    await message.react('3️⃣');
    topCategories.push("best of three");
  }
  
  // Check if it's the best unlimited (always applies)
  if (scoreData.strokes < lowestUnlimitedScore) {
    // Only add trophy if we didn't already add it for another category
    if (topCategories.length === 0) {
      await message.react('🏆');
    }
    await message.react('♾️');
    topCategories.push("unlimited attempts");
  }
  
  // Check if this is the first score of the day by counting all scores
  const isFirstScoreOfDay = firstScores.length <= 1 && bestOfThreeScores.length <= 1 && unlimitedScores.length <= 1;
  
  // If this score is the best in any category and not the first score of day, send a congratulatory message
  if (topCategories.length > 0 && !isFirstScoreOfDay) {
    const categoryText = topCategories.join(" and ");
    await message.reply(`Congratulations! This is the lowest score today for ${categoryText}! 🏆`);
  }
}