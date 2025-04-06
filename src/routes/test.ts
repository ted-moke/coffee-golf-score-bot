import express from 'express';
import { addScore, getDailyScores, getRecentScores, loadData, saveData, formatDate, getTodayString } from '../utils/storage';
import { Score, ScoringType } from '../types';

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
        const scores = await getDailyScores(getTodayString(), scoringType);
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

export default router; 