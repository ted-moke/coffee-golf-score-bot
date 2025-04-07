import { Message } from 'discord.js';
import { parseScoreMessage } from '../utils/scoreParser';
import { addScore, getPlayerAttemptsToday, getDailyScores } from '../utils/storage';
import { ScoringType } from '../types';

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
  
  console.log(`Message received in target channel from ${message.author.username}: "${message.content}"`);
  
  // Try to parse the message as a score submission
  const scoreData = parseScoreMessage(message);
  
  if (scoreData) {
    console.log(`Parsed score data:`, JSON.stringify(scoreData, null, 2));
    
    // Check attempts
    const currentAttempts = await getPlayerAttemptsToday(scoreData.playerId);
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
      // Get all scores for today using unlimited scoring to check if this is the best
      const todayScores = await getDailyScores(scoreData.date, ScoringType.UNLIMITED);
      const lowestScore = Math.min(...todayScores.map(s => s.strokes)) || Infinity;
      
      // If this score is the lowest (or tied for lowest), add trophy reaction
      if (scoreData.strokes <= lowestScore) {
        await message.react('🏆');
        await message.reply(`This is the lowest score so far today! ${scoreData.playerName} is leading the pack!`);
      }
      
      console.log(`Recorded score for ${scoreData.playerName}: ${scoreData.strokes} strokes (Attempt ${attemptNumber}/${MAX_ATTEMPTS})`);
    } catch (error) {
      console.error('Error handling score message:', error);
    }
  }
}