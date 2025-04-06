discord-coffee_golf/
├── src/
│   ├── index.ts              # Main entry point
│   ├── bot.ts                # Bot initialization
│   ├── commands/             # Command handlers
│   │   ├── leaderboard.ts    # Leaderboard command
│   ├── events/               # Discord event handlers
│   │   ├── messageCreate.ts  # Message handler for score tracking
│   ├── utils/                # Utility functions
│   │   ├── scoreParser.ts    # Parse scores from messages
│   │   ├── storage.ts        # Data storage functions
│   ├── types/                # TypeScript type definitions
│   │   ├── index.ts          # Type definitions
├── .env                      # Environment variables
├── tsconfig.json             # TypeScript configuration
├── package.json              # Project dependencies
├── data/                     # Data storage directory
│   ├── scores.json           # Score data storage