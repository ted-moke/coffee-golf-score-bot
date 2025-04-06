import { Message } from 'discord.js';
import { Score } from '../types';
import { formatDate } from './storage';

// Extract scores from message content
export function parseScoreMessage(message: Message): Score | null {
  const content = message.content.trim();
  
  // Regex pattern to match "Coffee Golf - [Date] [Score] Strokes"
  // Example: "Coffee Golf - Apr 5 13 Strokes"
  const scorePattern = /Coffee Golf\s*-\s*([A-Za-z]+\s+\d+)\s*(\d+)\s*Strokes/i;
  const match = content.match(scorePattern);
  
  if (!match) {
    return null; // Not a valid score message
  }
  
  // Extract components
  const dateStr = match[1]; // "Apr 5"
  const strokes = parseInt(match[2], 10); // 13
  
  // Get emoji route if present (any emojis in the message)
  const emojiPattern = /[\p{Emoji}]/gu;
  const emojis = content.match(emojiPattern);
  const route = emojis ? emojis.join('') : undefined;
  
  // Parse date string (e.g., "Apr 5" to YYYY-MM-DD) in NY timezone
  const currentYear = new Date().getFullYear();
  const dateObj = new Date(`${dateStr}, ${currentYear}`);
  // Convert the date to NY timezone
  const nyDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const formattedDate = formatDate(nyDate);
  
  // Create score object with timestamp
  const score: Score = {
    playerId: message.author.id,
    playerName: message.author.username,
    date: formattedDate,
    strokes: strokes,
    messageId: message.id,
    timestamp: message.createdTimestamp,  // Add timestamp to track order
    route: route
  };
  
  return score;
}