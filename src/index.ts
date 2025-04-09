import express from 'express';
import { startBot } from './bot';
import testRoutes from './routes/test';

// Add Express for HTTP server
const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Register routes
app.use('/test', testRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  
  // Start the Discord bot
  startBot();
});