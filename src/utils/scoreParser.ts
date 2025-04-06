import { Message } from 'discord.js';
import { Score } from '../types';

// Extract scores from message content
export function parseScoreMessage(message: Message): Score | null {
  const content = message.content.toLowerCase();
  
  // Match pattern: "Apr 5: 13" or "Apr 5 - 13" or "Apr 5 13"
  const pattern = /([a-z]{3}\s+\d{1,2})(?::|-)?\s*(\d{1,2})/i;
  const match = content.match(pattern);
  
  if (!match) {
    return null;
  }
  
  // Extract components
  const dateStr = match[1]; // "Apr 5"
  const strokes = parseInt(match[2], 10); // 13
  
  // Get emoji route if present (any emojis in the message)
  const emojiPattern = /[\p{Emoji}]/gu;
  const emojis = content.match(emojiPattern);
  const route = emojis ? emojis.join('') : undefined;
  
  // Parse date string (e.g., "Apr 5" to YYYY-MM-DD)
  const currentYear = new Date().getFullYear();
  const dateObj = new Date(`${dateStr}, ${currentYear}`);
  const formattedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Create score object with timestamp
  const score: Score = {
    playerId: message.author.id,
    playerName: message.author.username,
    date: formattedDate,
    strokes: strokes,
    messageId: message.id,
    timestamp: message.createdTimestamp,
    route: route
  };
  
  return score;
}