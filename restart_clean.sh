#!/bin/bash

# Stop containers and remove volumes (orphans)
echo "Stopping containers and removing volumes..."
docker-compose down -v

# Prune system to ensure no cached layers cause issues (optional but safer)
# docker system prune -f 

# Start containers with build
echo "Starting containers..."
docker-compose up -d --build

echo "Restart complete. Uploads volume should now be correctly mounted."
