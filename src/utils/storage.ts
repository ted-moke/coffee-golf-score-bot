import { Storage } from '@google-cloud/storage';
import { ScoreData, Score, PlayerStats, ScoringType } from '../types';
import { config } from 'dotenv';
import NodeCache from 'node-cache';

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

// Cache for score data (TTL: 5 minutes)
const scoreCache = new NodeCache({ stdTTL: 300 });

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
  
  // Clear cache after adding a new score
  scoreCache.del('scoreData');
  
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
  console.log(`getDailyScores() called with date: ${date} scoringType: ${scoringType}`);
  
  // Create cache key based on date
  const cacheKey = `scores_${date}`;
  
  // Check if raw scores for this date are cached
  let dailyScores = scoreCache.get(cacheKey) as Record<string, Score[]>;
  
  if (!dailyScores) {
    // First ensure base data is loaded if it isn't already cached
    if (!scoreCache.has('scoreData')) {
      // Preload all score data into cache
      const data = await loadData();
      scoreCache.set('scoreData', data);
      console.log('Preloaded score data into cache');
    }
    
    // Get the cached data (with null check)
    const data = scoreCache.get('scoreData') as ScoreData | undefined;
    dailyScores = {};
    
    // Extract scores for the specific date with null check
    if (data && data.dailyScores && data.dailyScores[date]) {
      dailyScores = data.dailyScores[date];
    }
    
    // Cache the raw scores for this date
    scoreCache.set(cacheKey, dailyScores);
    console.log(`Cached scores for date: ${date}`);
  }
  
  console.log(`Found cached scores for date: ${date}`);
  
  // Now apply scoring type filters in memory (no need for another storage call)
  return applyScoring(dailyScores, scoringType);
}

// Helper function to apply scoring type filters to raw scores
function applyScoring(rawScores: Record<string, Score[]>, scoringType: ScoringType): Score[] {
  const result: Score[] = [];
  
  Object.values(rawScores).forEach(playerScores => {
    // Sort by timestamp (oldest first)
    const sortedScores = [...playerScores].sort((a, b) => a.timestamp - b.timestamp);
    
    switch (scoringType) {
      case ScoringType.FIRST:
        // First attempt only
        if (sortedScores.length > 0) {
          result.push(sortedScores[0]);
        }
        break;
      case ScoringType.BEST:
        // Best of first three attempts
        if (sortedScores.length > 0) {
          const firstThree = sortedScores.slice(0, 3);
          const best = firstThree.reduce((min, score) => 
            score.strokes < min.strokes ? score : min, firstThree[0]);
          result.push(best);
        }
        break;
      case ScoringType.UNLIMITED:
        // Best score overall
        if (sortedScores.length > 0) {
          const best = sortedScores.reduce((min, score) => 
            score.strokes < min.strokes ? score : min, sortedScores[0]);
          result.push(best);
        }
        break;
    }
  });
  
  return result;
}

// Get recent scores (last X days)
export async function getRecentScores(days: number, scoringType: ScoringType): Promise<Record<string, Score[]>> {
  console.log(`Getting recent scores for last ${days} days with scoring type ${scoringType}`);
  const data = await loadData();
  
  // Get the current date in NYC timezone
  const endDate = getNYCTodayDate();
  // Calculate start date by subtracting days
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1); // +1 to include today
  
  console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
  
  // Get dates in range
  const datesInRange: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    datesInRange.push(formatDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`Dates in range: ${datesInRange.join(', ')}`);
  
  // Collect scores by player
  const recentScores: Record<string, Score[]> = {};
  
  // Wait for all daily scores to be fetched
  await Promise.all(datesInRange.map(async (date) => {
    console.log(`Fetching scores for date: ${date}`);
    const dailyScores = await getDailyScores(date, scoringType);
    console.log(`Found ${dailyScores.length} scores for ${date}`);
    
    dailyScores.forEach(score => {
      if (!recentScores[score.playerId]) {
        recentScores[score.playerId] = [];
      }
      recentScores[score.playerId].push(score);
    });
  }));
  
  // Log the collected scores for debugging
  Object.entries(recentScores).forEach(([playerId, scores]) => {
    console.log(`Player ${playerId} has ${scores.length} scores in date range`);
    scores.forEach(score => {
      console.log(`  ${score.date}: ${score.strokes} strokes`);
    });
  });
  
  return recentScores;
}

// Get player's attempts count for today
export async function getPlayerAttemptsToday(playerId: string, date?: Date): Promise<number> {
  if (!date) {
    date = new Date();
  }
  
  const today = formatDate(date);
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

export function getNYCTodayString(): string {
  const nyDate = new Date(Date.now() - 4 * 60 * 60 * 1000);
  console.log('getNYCTodayString() returned:', nyDate.toISOString());
  return formatDate(nyDate);
}

export function getNYCTodayDate(): Date {
  const nyDate = new Date(Date.now() - 4 * 60 * 60 * 1000);
  console.log('getNYCTodayDate() returned:', nyDate.toISOString());
  console.log('now', new Date().toISOString());
  return nyDate;
}

export { ScoringType };