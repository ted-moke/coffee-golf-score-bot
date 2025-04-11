import express from 'express';
import { addScore, getDailyScores, getRecentScores, loadData, saveData, formatDate, getTodayString, getNYCTodayString, getNYCTodayDate } from '../utils/storage';
import { LeaderboardEntry, Score, ScoringType } from '../types';
import { getScoringTypeFromString, getScoringTypeDisplay } from '../utils/scoring';

const router = express.Router();

// Get current data
router.get('/data', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load data' });
    }
});

// Add a test score
router.post('/score', async (req, res) => {
    try {
        const mockScore: Score = {
            playerId: 'test-user-' + Math.floor(Math.random() * 3), // Random user 0-2
            playerName: 'Test User',
            date: getTodayString(),
            strokes: Math.floor(Math.random() * 10) + 5, // Random score 5-14
            messageId: 'test-' + Date.now(),
            timestamp: Date.now(),
            route: '🟦🟨🟩'
        };

        const result = await addScore(mockScore);
        res.json({ score: mockScore, result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add score' });
    }
});

// Get today's scores
router.get('/scores/today', async (req, res) => {
    try {
        const scoringType = (req.query.scoring as ScoringType) || ScoringType.FIRST;
        const scores = await getDailyScores(getNYCTodayString(), scoringType);
        res.json(scores);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get scores' });
    }
});

// Get recent scores
router.get('/scores/recent', async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const scoringType = (req.query.scoring as ScoringType) || ScoringType.FIRST;
        const scores = await getRecentScores(days, scoringType);
        res.json(scores);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get recent scores' });
    }
});

// Add multiple random scores for testing
router.post('/scores/bulk', async (req, res) => {
    try {
        const count = parseInt(req.query.count as string) || 5;
        const results = [];
        
        for (let i = 0; i < count; i++) {
            const mockScore: Score = {
                playerId: 'test-user-' + Math.floor(Math.random() * 3),
                playerName: 'Test User ' + Math.floor(Math.random() * 3),
                date: formatDate(new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000)), // Random day in last week
                strokes: Math.floor(Math.random() * 10) + 5,
                messageId: 'test-' + Date.now() + '-' + i,
                timestamp: Date.now() - Math.floor(Math.random() * 86400000),
                route: '🟦🟨🟩'
            };
            
            const result = await addScore(mockScore);
            results.push({ score: mockScore, result });
        }
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add bulk scores' });
    }
});

// Test date handling
router.get('/dates', (req, res) => {
    const now = new Date();
    const results = {
        currentUTCDate: now.toISOString(),
        currentNYString: getTodayString(),
        yesterday: formatDate(new Date(now.getTime() - 86400000)),
        today: formatDate(now),
        tomorrow: formatDate(new Date(now.getTime() + 86400000))
    };
    res.json(results);
});

// Add a test score with specific date
router.post('/score/date', async (req, res) => {
    try {
        const dateStr = req.query.date as string || getTodayString(); // YYYY-MM-DD format
        const mockScore: Score = {
            playerId: 'test-user-' + Math.floor(Math.random() * 3),
            playerName: 'Test User',
            date: dateStr,
            strokes: Math.floor(Math.random() * 10) + 5,
            messageId: 'test-' + Date.now(),
            timestamp: Date.now(),
            route: '🟦🟨🟩'
        };

        const result = await addScore(mockScore);
        res.json({ score: mockScore, result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add score' });
    }
});

// Get scores for specific date
router.get('/scores/date', async (req, res) => {
    try {
        const dateStr = req.query.date as string || getTodayString();
        const scoringType = (req.query.scoring as ScoringType) || ScoringType.FIRST;
        const scores = await getDailyScores(dateStr, scoringType);
        res.json({
            date: dateStr,
            scoringType,
            scores,
            count: scores.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get scores' });
    }
});

// Test route for checking server status
router.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Test route is working' });
});

// Test route for today's leaderboard
router.get('/leaderboard/today', async (req, res) => {
    try {
        const scoringOption = req.query.scoring as string || 'first';
        const today = getNYCTodayString();
        
        if (scoringOption === 'all') {
            // Show all scoring types
            const results: Record<string, Score[]> = {};
            
            for (const type of [ScoringType.FIRST, ScoringType.BEST, ScoringType.UNLIMITED]) {
                const scores = await getDailyScores(today, type);
                const sortedScores = scores.sort((a, b) => a.strokes - b.strokes);
                results[getScoringTypeDisplay(type)] = sortedScores;
            }
            
            res.json({
                title: `Coffee Golf Leaderboard - Today (${today})`,
                description: 'All Scoring Types',
                results
            });
        } else {
            // Show single scoring type
            const scoringType = getScoringTypeFromString(scoringOption);
            const scores = await getDailyScores(today, scoringType);
            const sortedScores = scores.sort((a, b) => a.strokes - b.strokes);
            
            res.json({
                title: `Coffee Golf Leaderboard - Today (${today})`,
                description: getScoringTypeDisplay(scoringType),
                scores: sortedScores
            });
        }
    } catch (error) {
        console.error('Error in test leaderboard/today:', error);
        res.status(500).json({ error: 'Failed to get today\'s leaderboard' });
    }
});

// Test route for recent leaderboard
router.get('/leaderboard/recent', async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const scoringOption = req.query.scoring as string || 'first';
        
        if (scoringOption === 'all') {
            // Show all scoring types
            const results: Record<string, LeaderboardEntry[]> = {};
            
            for (const type of [ScoringType.FIRST, ScoringType.BEST, ScoringType.UNLIMITED]) {
                const recentScores = await getRecentScores(days, type);
                
                // Calculate cumulative scores and average for each player
                const playerCumulativeScores = Object.entries(recentScores).map(([playerId, scores]) => {
                    const totalStrokes = scores.reduce((sum, score) => sum + score.strokes, 0);
                    const avgStrokes = scores.length > 0 ? totalStrokes / scores.length : 0;
                    return {
                        playerId,
                        playerName: scores[0].playerName,
                        totalStrokes,
                        games: scores.length,
                        avgStrokes
                    };
                });
                
                // Sort by average strokes (lowest first), then by total games (highest first) for tiebreakers
                const sortedPlayers = playerCumulativeScores
                    .filter(player => player.games >= 1)
                    .sort((a, b) => {
                        if (a.avgStrokes !== b.avgStrokes) {
                            return a.avgStrokes - b.avgStrokes;
                        }
                        return b.games - a.games;
                    });
                    
                results[getScoringTypeDisplay(type)] = sortedPlayers;
            }
            
            res.json({
                title: `Coffee Golf Leaderboard - Last ${days} Days`,
                description: 'All Scoring Types',
                dateRange: `${formatDate(new Date(Date.now() - days * 86400000))} to ${formatDate()}`,
                results
            });
        } else {
            const scoringType = getScoringTypeFromString(scoringOption);
            const recentScores = await getRecentScores(days, scoringType);
            
            // Calculate cumulative scores and average for each player
            const playerCumulativeScores = Object.entries(recentScores).map(([playerId, scores]) => {
                const totalStrokes = scores.reduce((sum, score) => sum + score.strokes, 0);
                const avgStrokes = scores.length > 0 ? totalStrokes / scores.length : 0;
                return {
                    playerId,
                    playerName: scores[0].playerName,
                    totalStrokes,
                    games: scores.length,
                    avgStrokes
                };
            });
            
            // Sort by average strokes (lowest first), then by total games (highest first) for tiebreakers
            const sortedPlayers = playerCumulativeScores
                .filter(player => player.games >= 1)
                .sort((a, b) => {
                    if (a.avgStrokes !== b.avgStrokes) {
                        return a.avgStrokes - b.avgStrokes;
                    }
                    return b.games - a.games;
                });
            
            res.json({
                title: `Coffee Golf Leaderboard - Last ${days} Days`,
                description: getScoringTypeDisplay(scoringType),
                dateRange: `${formatDate(new Date(Date.now() - days * 86400000))} to ${formatDate()}`,
                players: sortedPlayers
            });
        }
    } catch (error) {
        console.error('Error in test leaderboard/recent:', error);
        res.status(500).json({ error: 'Failed to get recent leaderboard' });
    }
});

export default router; 