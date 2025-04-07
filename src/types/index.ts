// Score data structure
export interface Score {
    playerId: string;
    playerName: string;
    date: string;
    strokes: number;
    messageId: string;
    timestamp: number; // Added to track order of scores
    route?: string; // Emoji representation of route
  }
  
  // Player statistics
  export interface PlayerStats {
    id: string;
    name: string;
    bestScore: number;
    averageScore: number;
    totalGames: number;
    scores: Score[];
  }
  
  // Daily scores collection - now contains arrays of scores per player
  export interface DailyScores {
    [date: string]: {
      [playerId: string]: Score[];
    };
  }
  
  // Tournament data
  export interface Tournament {
    name: string;
    startDate: string;
    endDate: string;
    participants: string[]; // Player IDs
    active: boolean;
    scoringType: 'first' | 'best'; // Track which scoring type to use for this tournament
  }
  
  // Main data structure for storage
  export interface ScoreData {
    players: {
      [playerId: string]: PlayerStats;
    };
    dailyScores: DailyScores;
    tournaments: Tournament[];
    currentTournament?: string; // Name of active tournament
  }
  
  // Scoring types enum
  export enum ScoringType {
    FIRST = 'first',
    BEST = 'best',
    UNLIMITED = 'unlimited'
  }