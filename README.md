# Coffee Golf Discord Bot

The Coffee Golf Discord Bot is a tool for tracking and displaying scores from a daily mobile game called Coffee Golf. It allows players to post their scores in a Discord channel, and the bot maintains leaderboards for daily and recent scores. The bot also supports different scoring types and can manage tournaments.

## Features

- **Score Tracking:** Automatically parse and track scores posted in a specific format.
- **Leaderboards:** Display leaderboards for today's scores and recent scores over a specified number of days.
- **Scoring Types:** Support for two scoring types: first attempt and best of three attempts.
- **Tournament Management:** Basic structure for creating and ending tournaments (future enhancements planned).

## Setup

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node Package Manager)
- A Discord bot token

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/discord-coffee_golf.git
   cd discord-coffee_golf
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**

   Create a `.env` file in the root directory and add your Discord bot token and target channel ID:

   ```plaintext
   DISCORD_TOKEN=your_discord_bot_token
   CHANNEL_ID=your_target_channel_id
   ```

4. **Build the Project:**

   ```bash
   npm run build
   ```

5. **Start the Bot:**

   For development:

   ```bash
   npm run dev
   ```

   For production:

   ```bash
   npm start
   ```

## Usage

### Commands

- **/leaderboard today [scoring]:** Show today's leaderboard. Optionally specify the scoring type (`first` or `best`).
- **/leaderboard recent [days] [scoring]:** Show the leaderboard for recent days. Specify the number of days and optionally the scoring type.

### Score Submission

Post scores via the share function in the game, which copies to your clipboard data.  Paste that data into the target channel:

```
[Player Name] [Score] [Scoring Type]
```

Example:

Coffee Golf - Apr 5
10 Strokes

🟪🟨🟩🟦🟥
2️⃣2️⃣2️⃣2️⃣2️⃣

## Hosting on Google Cloud Run

### Create secrets

gcloud secrets create DISCORD_TOKEN --data-file=- <<< "your_discord_token"
gcloud secrets create CHANNEL_ID --data-file=- <<< "your_channel_id"

### Grant access to Cloud Run

gcloud secrets add-iam-policy-binding DISCORD_TOKEN \
    --member="serviceAccount:service-[PROJECT_NUMBER]@gcp-sa-cloudrun.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding CHANNEL_ID \
    --member="serviceAccount:service-[PROJECT_NUMBER]@gcp-sa-cloudrun.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

## Build and Deploy

### Build

`npm run build`

`docker build -t us-central1-docker.pkg.dev/[PROJECT-ID]/[REPO-NAME]/[IMAGE-NAME] .`

Push docker image up to Google Artifact Registry

`docker push us-central1-docker.pkg.dev/[PROJECT-ID]/[REPO-NAME]/[IMAGE-NAME]`

### Deploy

```
gcloud run deploy coffee-golf-discord-bot \
  --image us-central1-docker.pkg.dev/[PROJECT-ID]/[REPO-NAME]/[IMAGE-NAME] \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="DISCORD_TOKEN=DISCORD_TOKEN:latest,CHANNEL_ID=CHANNEL_ID:latest"
```


### Deploy with secrets

gcloud run deploy coffee-golf-bot \
  --image gcr.io/[PROJECT-ID]/coffee-golf-bot \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="TOKEN=DISCORD_TOKEN:latest,CHANNEL_ID=CHANNEL_ID:latest"

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Future Enhancements

- Full implementation of tournament management features.
- Additional commands for managing and viewing tournament leaderboards.
- Improved error handling and user feedback.

## Contact

For questions or support, please contact [your email or Discord username].
