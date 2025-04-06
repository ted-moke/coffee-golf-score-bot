import fs from 'fs';
import path from 'path';
import { ScoreData, Score, PlayerStats, ScoringType } from '../types';

// File path for score data
const DATA_DIR = path.join(__dirname, '../../data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

// Default empty data structure
const defaultData: ScoreData = {
  players: {},
  dailyScores: {},
  tournaments: []
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load data from file or create new file if it doesn't exist
export function loadData(): ScoreData {
  try {
    if (fs.existsSync(SCORES_FILE)) {
      const data = fs.readFileSync(SCORES_FILE, 'utf8');
      return JSON.parse(data) as ScoreData;
    }
    
    // If file doesn't exist, create it with default data
    saveData(defaultData);
    return defaultData;
  } catch (error) {
    console.error('Error loading score data:', error);
    return defaultData;
  }
}

// Save data to file
export function saveData(data: ScoreData): void {
  try {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving score data:', error);
  }
}

// Add a new score
export function addScore(score: Score): { isFirst: boolean, attemptNumber: number } {
  const data = loadData();
  const { playerId, date } = score;
  
  // Initialize daily scores for this date if needed
  if (!data.dailyScores[date]) {
    data.dailyScores[date] = {};
  }
  
  // Initialize player's daily scores array if needed
  if (!data.dailyScores[date][playerId]) {
    data.dailyScores[date][playerId] = [];
  }
  
  // Add score to player's daily scores
  data.dailyScores[date][playerId].push(score);
  
  // Initialize player if needed
  if (!data.players[playerId]) {
    data.players[playerId] = {
      id: playerId,
      name: score.playerName,
      bestScore: Infinity,
      averageScore: 0,
      totalGames: 0,
      scores: []
    };
  }
  
  // Update player name in case it changed
  data.players[playerId].name = score.playerName;
  
  // Add score to player history
  data.players[playerId].scores.push(score);
  
  // Update player stats
  const playerScores = data.players[playerId].scores;
  data.players[playerId].totalGames = playerScores.length;
  
  // Update best score if applicable
  if (score.strokes < data.players[playerId].bestScore) {
    data.players[playerId].bestScore = score.strokes;
  }
  
  // Update average
  const totalStrokes = playerScores.reduce((sum, s) => sum + s.strokes, 0);
  data.players[playerId].averageScore = totalStrokes / playerScores.length;
  
  // Save updated data
  saveData(data);
  
  // Return if this was their first score of the day and which attempt it was
  const isFirst = data.dailyScores[date][playerId].length === 1;
  const attemptNumber = data.dailyScores[date][playerId].length;
  
  return { isFirst, attemptNumber };
}

// Get player's daily scores
export function getPlayerDailyScores(playerId: string, date: string): Score[] {
  const data = loadData();
  if (!data.dailyScores[date] || !data.dailyScores[date][playerId]) {
    return [];
  }
  return data.dailyScores[date][playerId];
}

// Get player stats
export function getPlayerStats(playerId: string): PlayerStats | null {
  const data = loadData();
  return data.players[playerId] || null;
}

// Get all scores for a specific date by scoring type
export function getDailyScores(date: string, scoringType: ScoringType): Score[] {
  const data = loadData();
  const dailyScores = data.dailyScores[date] || {};
  const scores: Score[] = [];
  
  Object.entries(dailyScores).forEach(([playerId, playerScores]) => {
    if (!Array.isArray(playerScores) || playerScores.length === 0) return;
    
    if (scoringType === ScoringType.FIRST) {
      // Get first score (sorted by timestamp)
      const sortedScores = [...playerScores].sort((a, b) => a.timestamp - b.timestamp);
      scores.push(sortedScores[0]);
    } else if (scoringType === ScoringType.BEST) {
      // Get best score (lowest strokes)
      const bestScore = [...playerScores].sort((a, b) => a.strokes - b.strokes)[0];
      scores.push(bestScore);
    }
  });
  
  return scores;
}

// Get recent scores (last X days)
export function getRecentScores(days: number, scoringType: ScoringType): Record<string, Score[]> {
  const data = loadData();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get dates in range
  const datesInRange: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    datesInRange.push(formatDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Collect scores by player
  const recentScores: Record<string, Score[]> = {};
  
  datesInRange.forEach(date => {
    const dailyScores = getDailyScores(date, scoringType);
    
    dailyScores.forEach(score => {
      if (!recentScores[score.playerId]) {
        recentScores[score.playerId] = [];
      }
      recentScores[score.playerId].push(score);
    });
  });
  
  return recentScores;
}

// Get player's attempts count for today
export function getPlayerAttemptsToday(playerId: string): number {
  const today = getTodayString();
  const data = loadData();
  
  if (!data.dailyScores[today] || !data.dailyScores[today][playerId]) {
    return 0;
  }
  
  return data.dailyScores[today][playerId].length;
}

// Get today's date string in local time (America/New_York)
export function getTodayString(): string {
  const date = new Date();
  // Convert to NY time
  const nyDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return formatDate(nyDate);
}

// Format date to YYYY-MM-DD
export function formatDate(date: Date = new Date()): string {
  // Convert to NY time
  const nyDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year = nyDate.getFullYear();
  const month = String(nyDate.getMonth() + 1).padStart(2, '0');
  const day = String(nyDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export { ScoringType };