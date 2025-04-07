#!/bin/bash

# Exit on any error
set -e

# Load environment variables from .env file, handling Windows line endings
if [ -f .env ]; then
    echo "📝 Loading configuration from .env file..."
    export $(cat .env | tr -d '\r' | grep -v '^#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Clean variables
PROJECT_ID=$(echo "${PROJECT_ID}" | tr -d '\r')
SERVICE_NAME=$(echo "${SERVICE_NAME:-coffee-golf-discord-bot}" | tr -d '\r')

view_secret() {
    local secret_name=$1
    echo "👀 Viewing latest version of secret: $secret_name"
    gcloud secrets versions access latest --secret="$secret_name"
}

update_secret() {
    local secret_name=$1
    local env_var_name=$2
    local override_value=$3
    local secret_value=${override_value:-${!env_var_name}}

    if [ -z "$secret_value" ]; then
        echo "⚠️ Warning: No value provided for $secret_name"
        return
    fi

    # Clean the secret value (remove whitespace and newlines)
    secret_value=$(echo "$secret_value" | tr -d '[:space:]')

    echo "🔄 Updating secret: $secret_name"
    # First create the secret if it doesn't exist
    gcloud secrets create "$secret_name" --quiet 2>/dev/null || true
    # Then update its value
    echo -n "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=-
}

update_all_secrets() {
    echo "🔐 Updating all secrets..."
    update_secret "DISCORD_TOKEN" "DISCORD_TOKEN"
    update_secret "CHANNEL_ID" "CHANNEL_ID"
    update_secret "BUCKET_NAME" "BUCKET_NAME"
    
    # Special handling for JSON file
    if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        echo "🔄 Updating GOOGLE_APPLICATION_CREDENTIALS_JSON from file"
        gcloud secrets create "GOOGLE_APPLICATION_CREDENTIALS_JSON" --quiet 2>/dev/null || true
        gcloud secrets versions add "GOOGLE_APPLICATION_CREDENTIALS_JSON" --data-file="$GOOGLE_APPLICATION_CREDENTIALS"
    else
        echo "⚠️ Warning: GOOGLE_APPLICATION_CREDENTIALS file not found"
    fi
}

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    echo "Usage:"
    echo "  ./update_secrets.sh all                              # Update all secrets"
    echo "  ./update_secrets.sh discord                         # Update DISCORD_TOKEN"
    echo "  ./update_secrets.sh channel                         # Update CHANNEL_ID"
    echo "  ./update_secrets.sh channel <channel-id>            # Update CHANNEL_ID with specific value"
    echo "  ./update_secrets.sh bucket                         # Update BUCKET_NAME"
    echo "  ./update_secrets.sh credentials                     # Update GOOGLE_APPLICATION_CREDENTIALS_JSON"
    echo "  ./update_secrets.sh view <secret-name>             # View current value of a secret"
    exit 1
fi

# Process arguments
while [ $# -gt 0 ]; do
    case "$1" in
        all)
            update_all_secrets
            shift
            ;;
        discord)
            if [ -n "$2" ] && [[ "$2" != -* ]]; then
                update_secret "DISCORD_TOKEN" "DISCORD_TOKEN" "$2"
                shift 2
            else
                update_secret "DISCORD_TOKEN" "DISCORD_TOKEN"
                shift
            fi
            ;;
        channel)
            if [ -n "$2" ] && [[ "$2" != -* ]]; then
                update_secret "CHANNEL_ID" "CHANNEL_ID" "$2"
                shift 2
            else
                update_secret "CHANNEL_ID" "CHANNEL_ID"
                shift
            fi
            ;;
        bucket)
            if [ -n "$2" ] && [[ "$2" != -* ]]; then
                update_secret "BUCKET_NAME" "BUCKET_NAME" "$2"
                shift 2
            else
                update_secret "BUCKET_NAME" "BUCKET_NAME"
                shift
            fi
            ;;
        credentials)
            if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
                gcloud secrets create "GOOGLE_APPLICATION_CREDENTIALS_JSON" --quiet 2>/dev/null || true
                gcloud secrets versions add "GOOGLE_APPLICATION_CREDENTIALS_JSON" --data-file="$GOOGLE_APPLICATION_CREDENTIALS"
            else
                echo "⚠️ Error: GOOGLE_APPLICATION_CREDENTIALS file not found"
                exit 1
            fi
            shift
            ;;
        view)
            if [ -n "$2" ]; then
                view_secret "$2"
                shift 2
            else
                echo "❌ Error: Secret name required for view command"
                exit 1
            fi
            ;;
        *)
            echo "❌ Unknown argument: $1"
            exit 1
            ;;
    esac
done

echo "✅ Secret update complete!" 