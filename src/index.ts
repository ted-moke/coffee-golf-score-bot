import { startBot } from './bot';
import express from 'express';

// Add Express for HTTP server
const app = express();
const port = process.env.PORT || 8080;

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
  console.log(`Server listening on port ${port}`);
});