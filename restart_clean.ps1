# Stop containers and remove volumes (orphans)
Write-Host "Stopping containers and removing volumes..."
docker-compose down -v

# Prune system to ensure no cached layers cause issues (optional but safer)
# docker system prune -f 

# Start containers with build
Write-Host "Starting containers..."
docker-compose up -d --build

Write-Host "Restart complete. Uploads volume should now be correctly mounted."
