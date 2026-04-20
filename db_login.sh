#!/bin/bash

# Check if .env.development exists
ENV_FILE=".env.development"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found in current directory."
    exit 1
fi

# Function to get value from env file
get_env_val() {
    grep "^$1=" "$ENV_FILE" | cut -d'=' -f2 | sed 's/^"//;s/"$//'
}

# Extract database credentials
DB_HOST=$(get_env_val "DB_HOST")
DB_USER=$(get_env_val "DB_USER")
DB_PASS=$(get_env_val "DB_PASS")
DB_NAME=$(get_env_val "DB_NAME")
DB_PORT=$(get_env_val "DB_PORT")

# Default port if not set
if [ -z "$DB_PORT" ]; then
    DB_PORT=5432
fi

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed or not in PATH."
    exit 1
fi

# Set password for non-interactive login
export PGPASSWORD="$DB_PASS"

echo "🚀 Connecting to PostgreSQL..."
echo "📍 Host: $DB_HOST"
echo "👤 User: $DB_USER"
echo "📦 Database: $DB_NAME"
echo "🔌 Port: $DB_PORT"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
