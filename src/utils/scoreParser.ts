import { Message } from 'discord.js';
import { Score } from '../types';

// Extract scores from message content
export function parseScoreMessage(message: Message): Score | null {
  const content = message.content;
  const lines = content.split('\n');
  
  // Look for date pattern in any line
  // Support both abbreviated (Apr, May, Jun) and full month names (April, May, June)
  const datePattern = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i;
  
  let dateMatch = null;
  let dateStr = '';
  
  for (const line of lines) {
    const match = line.match(datePattern);
    if (match) {
      dateMatch = match;
      dateStr = match[0]; // Full matched string like "June 7"
      break;
    }
  }
  
  if (!dateMatch) {
    console.error(`No date found in message: "${content}"`);
    return null;
  }
  
  // Look for strokes pattern in any line
  const strokesPattern = /(\d{1,2})\s+strokes?/i;
  let strokesMatch = null;
  
  for (const line of lines) {
    const match = line.match(strokesPattern);
    if (match) {
      strokesMatch = match;
      break;
    }
  }
  
  if (!strokesMatch) {
    return null;
  }
  
  const strokes = parseInt(strokesMatch[1], 10);
  
  // Get emoji route if present (any emojis in the message)
  const emojiPattern = /[\p{Emoji}]/gu;
  const emojis = content.match(emojiPattern);
  const route = emojis ? emojis.join('') : undefined;
  
  // Parse date string (e.g., "June 7" to YYYY-MM-DD)
  const currentYear = new Date().getFullYear();
  let dateObj: Date;
  
  try {
    // Try parsing with current year first
    dateObj = new Date(`${dateStr}, ${currentYear}`);
    
    // If the date is invalid or in the future (more than 1 day ahead), it might be from last year
    if (isNaN(dateObj.getTime()) || dateObj.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      dateObj = new Date(`${dateStr}, ${currentYear - 1}`);
    }
    
    // Final validation
    if (isNaN(dateObj.getTime())) {
      console.error(`Failed to parse date: "${dateStr}"`);
      return null;
    }
  } catch (error) {
    console.error(`Error parsing date "${dateStr}":`, error);
    return null;
  }
  
  let formattedDate = '';
  try {
    formattedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch (error) {
    console.error(`Error parsing date "${dateObj.toString()}":`, error);
    formattedDate = dateStr;
  }

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