import express from 'express';
import { startBot } from './bot';
import testRoutes from './routes/test';

// Add Express for HTTP server
const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Test routes
app.use('/test', testRoutes);

// Start the bot
console.log('Starting Coffee Golf bot...');
startBot().catch(error => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});

// Add health check endpoint
app.get('/', (req, res) => {
  res.send('Coffee Golf Bot is running!');
});

// Start HTTP server
app.listen(port, () => {
  console.log(`Test server listening at http://localhost:${port}`);
});