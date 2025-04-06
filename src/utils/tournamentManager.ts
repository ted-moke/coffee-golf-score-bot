import { Tournament, ScoringType } from '../types';
import { loadData, saveData, formatDate, getDailyScores } from './storage';

// Create a new tournament
export function createTournament(name: string, durationDays: number, scoringType: ScoringType): Tournament {
  const data = loadData();
  
  // Check if a tournament is already active
  if (data.currentTournament) {
    throw new Error(`A tournament is already active: ${data.currentTournament}`);
  }
  
  const startDate = formatDate();
  const endDate = formatDate(new Date(Date.now() + durationDays * 86400000));
  
  const tournament: Tournament = {
    name,
    startDate,
    endDate,
    participants: [],
    active: true,
    scoringType
  };
  
  // Add tournament to list
  data.tournaments.push(tournament);
  data.currentTournament = name;
  
  saveData(data);
  return tournament;
}

// End the current tournament
export function endTournament(): Tournament | null {
  const data = loadData();
  
  if (!data.currentTournament) {
    return null;
  }
  
  // Find the active tournament
  const tournamentIndex = data.tournaments.findIndex(t => t.name === data.currentTournament);
  if (tournamentIndex === -1) {
    return null;
  }
  
  // Mark as inactive
  data.tournaments[tournamentIndex].active = false;
  data.currentTournament = undefined;
  
  saveData(data);
  return data.tournaments[tournamentIndex];
}

// Get current tournament
export function getCurrentTournament(): Tournament | null {
  const data = loadData();
  
  if (!data.currentTournament) {
    return null;
  }
  
  return data.tournaments.find(t => t.name === data.currentTournament) || null;
}

// Get tournament by name
export function getTournament(name: string): Tournament | null {
  const data = loadData();
  return data.tournaments.find(t => t.name === name) || null;
}

// Get all tournaments
export function getAllTournaments(): Tournament[] {
  const data = loadData();
  return data.tournaments;
}

// Get tournament scores
export function getTournamentScores(tournamentName: string, scoringType?: ScoringType): Record<string, { player: string, totalStrokes: number, rounds: number, average: number }> {
  const data = loadData();
  
  // Find tournament
  const tournament = data.tournaments.find(t => t.name === tournamentName);
  if (!tournament) {
    return {};
  }
  
  // Use tournament's scoring type if not specified
  const useScoringType: ScoringType = scoringType || tournament.scoringType as ScoringType;
  
  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  
  // Get all dates in the tournament range
  const tournamentDates: string[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    tournamentDates.push(formatDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Collect scores for each day using the appropriate scoring type
  const playerScores: Record<string, { player: string, totalStrokes: number, rounds: number, scores: number[] }> = {};
  
  tournamentDates.forEach(date => {
    const dailyScores = getDailyScores(date, useScoringType);
    
    dailyScores.forEach(score => {
      if (!playerScores[score.playerId]) {
        playerScores[score.playerId] = {
          player: score.playerName,
          totalStrokes: 0,
          rounds: 0,
          scores: []
        };
      }
      
      playerScores[score.playerId].totalStrokes += score.strokes;
      playerScores[score.playerId].rounds += 1;
      playerScores[score.playerId].scores.push(score.strokes);
    });
  });
  
  // Calculate averages
  const result: Record<string, { player: string, totalStrokes: number, rounds: number, average: number }> = {};
  
  Object.entries(playerScores).forEach(([playerId, data]) => {
    if (data.rounds > 0) {
      result[playerId] = {
        player: data.player,
        totalStrokes: data.totalStrokes,
        rounds: data.rounds,
        average: data.totalStrokes / data.rounds
      };
    }
  });
  
  return result;
}

// Add player to active tournament
export function addPlayerToTournament(playerId: string): boolean {
  const data = loadData();
  
  if (!data.currentTournament) {
    return false;
  }
  
  // Find the active tournament
  const tournamentIndex = data.tournaments.findIndex(t => t.name === data.currentTournament);
  if (tournamentIndex === -1) {
    return false;
  }
  
  // Check if player is already in tournament
  if (data.tournaments[tournamentIndex].participants.includes(playerId)) {
    return true; // Already added
  }
  
  // Add player to tournament
  data.tournaments[tournamentIndex].participants.push(playerId);
  
  saveData(data);
  return true;
}

// Get tournament status - days remaining, etc.
export function getTournamentStatus(tournamentName: string): { 
  daysElapsed: number, 
  daysRemaining: number, 
  totalDays: number,
  isActive: boolean,
  scoringType: string
} | null {
  const data = loadData();
  
  // Find tournament
  const tournament = data.tournaments.find(t => t.name === tournamentName);
  if (!tournament) {
    return null;
  }
  
  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  const today = new Date();
  
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    daysElapsed: Math.max(0, daysElapsed),
    daysRemaining: Math.max(0, daysRemaining),
    totalDays,
    isActive: tournament.active,
    scoringType: tournament.scoringType
  };
}