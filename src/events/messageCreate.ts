import { Message } from 'discord.js';
import { parseScoreMessage } from '../utils/scoreParser';
import { addScore, getPlayerAttemptsToday } from '../utils/storage';

// Maximum attempts allowed per day
const MAX_ATTEMPTS = 3;

// Process incoming messages
export async function handleMessage(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Only process messages from the target channel
  const targetChannelId = process.env.CHANNEL_ID;
  if (message.channelId !== targetChannelId) return;
  
  // Try to parse the message as a score submission
  const scoreData = parseScoreMessage(message);
  
  if (scoreData) {
    // Check attempts
    const currentAttempts = getPlayerAttemptsToday(scoreData.playerId);
    
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
    const { isFirst, attemptNumber } = addScore(scoreData);
    
    // React to confirm score recorded
    try {
      await message.react('✅');
      
      // If it's their first score, add "1️⃣" reaction
      if (isFirst) {
        await message.react('1️⃣');
      }
      
      // Add attempt number reaction
      const attemptEmojis = ['1️⃣', '2️⃣', '3️⃣'];
      if (attemptNumber > 0 && attemptNumber <= attemptEmojis.length) {
        await message.react(attemptEmojis[attemptNumber - 1]);
      }
      
      // If they're on their last attempt, let them know
      if (attemptNumber === MAX_ATTEMPTS) {
        await message.reply(`This was your last attempt (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}) for today.`);
      }
      
      console.log(`Recorded score for ${scoreData.playerName}: ${scoreData.strokes} strokes (Attempt ${attemptNumber}/${MAX_ATTEMPTS})`);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }
}