import { Storage } from '@google-cloud/storage';
import { ScoreData, Score, PlayerStats, ScoringType } from '../types';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Cloud Storage with credentials if provided
let storage: Storage;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  console.log("Using credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON");
  storage = new Storage({ credentials });
} else {
  console.log("No credentials provided, using default Storage");
  storage = new Storage();
}
const BUCKET_NAME = process.env.BUCKET_NAME || 'no-bucket-name';
const SCORES_FILE = 'scores.json';

console.log('BUCKET_NAME', BUCKET_NAME);

// Default empty data structure
const defaultData: ScoreData = {
  players: {},
  dailyScores: {},
  tournaments: []
};

// Load data from Cloud Storage or create new file if it doesn't exist
export async function loadData(): Promise<ScoreData> {
  console.log('Loading score data from Cloud Storage');
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(SCORES_FILE);
    const exists = await file.exists();
    
    if (exists[0]) {
      const data = await file.download();
      const parsedData = JSON.parse(data[0].toString()) as ScoreData;
      console.log(`Loaded ${Object.keys(parsedData.players).length} players and ${Object.keys(parsedData.dailyScores).length} daily scores`);
      return parsedData;
    }
    
    console.log('No existing score data found, creating new file');
    // If file doesn't exist, create it with default data
    await saveData(defaultData);
    return defaultData;
  } catch (error) {
    console.error('Error loading score data:', error);
    return defaultData;
  }
}

// Save data to Cloud Storage
export async function saveData(data: ScoreData): Promise<void> {
  console.log('Saving score data to Cloud Storage');
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(SCORES_FILE);
    await file.save(JSON.stringify(data, null, 2));
    console.log('Score data saved successfully');
  } catch (error) {
    console.error('Error saving score data:', error);
  }
}

// Add a new score
export async function addScore(score: Score): Promise<{ isFirst: boolean, attemptNumber: number }> {
  const data = await loadData();
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
  await saveData(data);
  
  // Return if this was their first score of the day and which attempt it was
  const isFirst = data.dailyScores[date][playerId].length === 1;
  const attemptNumber = data.dailyScores[date][playerId].length;
  
  return { isFirst, attemptNumber };
}

// Get player's daily scores
export async function getPlayerDailyScores(playerId: string, date: string): Promise<Score[]> {
  const data = await loadData();
  if (!data.dailyScores[date] || !data.dailyScores[date][playerId]) {
    return [];
  }
  return data.dailyScores[date][playerId];
}

// Get player stats
export async function getPlayerStats(playerId: string): Promise<PlayerStats | null> {
  const data = await loadData();
  return data.players[playerId] || null;
}

// Get all scores for a specific date by scoring type
export async function getDailyScores(date: string, scoringType: ScoringType): Promise<Score[]> {
  console.log('getDailyScores() called with date:', date, 'scoringType:', scoringType);
  const data = await loadData();
  
  if (!data.dailyScores[date]) {
    console.log('No scores found for date:', date);
    return [];
  }

  const dailyScores = data.dailyScores[date];
  console.log('Found raw scores for date:', date, 'scores:', JSON.stringify(dailyScores, null, 2));

  // Convert object to array of scores
  const allScores = Object.values(dailyScores).flat();
  console.log('All scores for date:', allScores.length);

  if (scoringType === ScoringType.FIRST) {
    // Get first attempts only
    const firstAttempts = Object.values(dailyScores).map(attempts => attempts[0]);
    console.log('First attempts:', firstAttempts.length);
    return firstAttempts;
  } else {
    // Get best attempts
    const bestAttempts = Object.values(dailyScores).map(attempts => 
      attempts.reduce((best, current) => 
        current.strokes < best.strokes ? current : best
      )
    );
    console.log('Best attempts:', bestAttempts.length);
    return bestAttempts;
  }
}

// Get recent scores (last X days)
export async function getRecentScores(days: number, scoringType: ScoringType): Promise<Record<string, Score[]>> {
  const data = await loadData();
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
  
  // Wait for all daily scores to be fetched
  await Promise.all(datesInRange.map(async (date) => {
    const dailyScores = await getDailyScores(date, scoringType);
    
    dailyScores.forEach(score => {
      if (!recentScores[score.playerId]) {
        recentScores[score.playerId] = [];
      }
      recentScores[score.playerId].push(score);
    });
  }));
  
  return recentScores;
}

// Get player's attempts count for today
export async function getPlayerAttemptsToday(playerId: string): Promise<number> {
  const today = getTodayString();
  const data = await loadData();
  
  if (!data.dailyScores[today] || !data.dailyScores[today][playerId]) {
    return 0;
  }
  
  return data.dailyScores[today][playerId].length;
}

// Format date to YYYY-MM-DD
export function formatDate(date: Date = new Date()): string {
  const formatted = date.toISOString().split('T')[0];
  console.log('formatDate() input:', date, 'output:', formatted);
  return formatted;
}

// Get today's string representation
export function getTodayString(): string {
  const today = formatDate();
  console.log('getTodayString() returned:', today);
  return today;
}

export { ScoringType };