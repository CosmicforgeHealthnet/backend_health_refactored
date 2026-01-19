# VPS Deployment Workflow Guide

## The Complete Flow

This guide shows you **HOW TO** add applications, databases, and services to your VPS in a scalable way.

---

## Server Structure Explained

```
/root/
├── apps/                          # 🎯 YOUR APPLICATIONS LIVE HERE
│   ├── app-1/                     # Each app is isolated
│   │   ├── Dockerfile             # Defines how to build the app
│   │   ├── docker-compose.yml     # Defines how to run the app
│   │   ├── .env                   # App-specific secrets
│   │   ├── server.js              # Your actual code
│   │   ├── package.json           # Dependencies
│   │   └── postgres-data/         # Optional: dedicated DB data
│   ├── app-2/
│   └── app-3/
│
├── shared/                        # 🔧 SHARED INFRASTRUCTURE
│   ├── docker-compose.yml         # Runs Postgres, Redis, Nginx
│   ├── postgres/
│   │   └── data/                  # ALL PostgreSQL data stored here
│   ├── redis/
│   │   └── data/                  # ALL Redis data stored here
│   └── nginx/
│       ├── conf.d/                # Nginx configs for each app
│       │   ├── app-1.conf         # Routes traffic to app-1
│       │   ├── app-2.conf         # Routes traffic to app-2
│       │   └── app-3.conf
│       └── ssl/                   # SSL certificates
│           ├── app-1.crt
│           └── app-1.key
│
├── scripts/                       # 🤖 AUTOMATION SCRIPTS
│   ├── deploy.sh                  # Deploy any app: ./deploy.sh app-1
│   ├── backup.sh                  # Backup databases
│   └── health-check.sh            # Check if services are up
│
└── logs/                          # 📊 CENTRALIZED LOGS
    ├── nginx/                     # Nginx access/error logs
    ├── app-1.log
    └── app-2.log
```

---

## What Each Part Does

### 🎯 `/root/apps/` - Your Applications

**Purpose**: Each subdirectory = one application

**What happens here:**
- You deploy your Node.js apps
- Each app runs in its own Docker container
- Each app gets its own port (3001, 3002, 3003...)
- Apps connect to shared Postgres/Redis OR have their own

**Example:**
```
apps/ecommerce-api/     → Runs on port 3001
apps/blog-backend/      → Runs on port 3002
apps/chat-service/      → Runs on port 3003
```

---

### 🔧 `/root/shared/` - Shared Infrastructure

**Purpose**: Services that ALL apps can use

#### `shared/docker-compose.yml`
**What it does:**
- Starts PostgreSQL container (shared database server)
- Starts Redis container (shared cache/sessions)
- Starts Nginx container (web server/reverse proxy)
- Creates a Docker network so services can talk to each other

**Why shared?**
- **Cost-efficient**: One Postgres serves 10 apps
- **Easy management**: Update one config, affects all
- **Resource-efficient**: Less memory usage

#### `shared/postgres/data/`
**What it does:**
- Stores ALL database files permanently
- Even if container restarts, data survives
- Contains all databases: `app1_db`, `app2_db`, etc.

#### `shared/redis/data/`
**What it does:**
- Stores Redis persistent data
- Cache, sessions, queues for all apps

#### `shared/nginx/conf.d/`
**What it does:**
- Each `.conf` file = routing rules for one app
- Nginx reads all `.conf` files and routes traffic accordingly

**Example:**
```nginx
# app-1.conf
server {
    listen 80;
    server_name app1.com;
    location / {
        proxy_pass http://172.17.0.1:3001;  # Routes to app-1
    }
}

# app-2.conf
server {
    listen 80;
    server_name app2.com;
    location / {
        proxy_pass http://172.17.0.1:3002;  # Routes to app-2
    }
}
```

**Result:**
- `app1.com` → Goes to app on port 3001
- `app2.com` → Goes to app on port 3002

---

### 🤖 `/root/scripts/` - Automation

**Purpose**: Reusable commands for common tasks

#### `deploy.sh`
**What it does:**
```bash
./deploy.sh ecommerce-api
```
1. Goes to `~/apps/ecommerce-api`
2. Pulls latest code from GitHub
3. Rebuilds Docker image
4. Restarts container
5. Cleans up old images

#### `backup.sh`
**What it does:**
```bash
./backup.sh
```
1. Dumps all PostgreSQL databases
2. Saves to `/root/backups/`
3. Compresses files
4. Can auto-upload to S3/cloud storage

#### `health-check.sh`
**What it does:**
```bash
./health-check.sh
```
1. Checks if Postgres is responding
2. Checks if Redis is responding
3. Checks if each app is up
4. Sends alert if anything is down

---

### 📊 `/root/logs/` - Logs

**Purpose**: All application logs in one place

**What it does:**
- Nginx access logs: Who visited which app
- Nginx error logs: Any proxy errors
- App logs: Your console.log() outputs
- Easy to search and debug

---

## Architecture Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  VPS: 72.61.20.94    │
          │  Port 80/443 (Open)  │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   NGINX (Container)  │ ◄─── Shared service
          │   Port 80/443        │
          └──────────┬───────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │ App 1  │  │ App 2  │  │ App 3  │ ◄─── Your applications
   │:3001   │  │:3002   │  │:3003   │
   └───┬────┘  └───┬────┘  └───┬────┘
       │           │            │
       └───────────┼────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌─────────┐          ┌─────────┐
   │ Postgres│          │  Redis  │ ◄─── Shared services
   │ :5432   │          │  :6379  │
   └─────────┘          └─────────┘
        │                     │
        ▼                     ▼
   ┌─────────┐          ┌─────────┐
   │ DB Data │          │ Cache   │ ◄─── Persistent storage
   │ /data/  │          │ /data/  │
   └─────────┘          └─────────┘
```

---

## How Traffic Flows

### Example: User visits `app1.example.com`

1. **DNS** resolves to `72.61.20.94`
2. **Nginx** receives request on port 80/443
3. **Nginx** reads `app-1.conf`:
   ```nginx
   server_name app1.example.com;
   proxy_pass http://172.17.0.1:3001;
   ```
4. **Nginx** forwards request to port 3001
5. **App-1 container** receives request on port 3001
6. **App-1** queries Postgres at `shared-postgres:5432`
7. **App-1** caches data in Redis at `shared-redis:6379`
8. **App-1** sends response back to Nginx
9. **Nginx** sends response to user

**Total time: ~50ms**

---

## How Apps Connect to Services

### From App to Postgres

**In docker-compose.yml:**
```yaml
environment:
  DB_HOST: shared-postgres  # ← Container name
  DB_PORT: 5432
  DB_NAME: my_app_db
```

**Why "shared-postgres"?**
- Docker creates internal DNS
- Containers on same network can talk by name
- No need for IP addresses

### From App to Redis

**In your Node.js code:**
```javascript
const redis = require('redis');
const client = redis.createClient({
  host: 'shared-redis',  // ← Container name
  port: 6379
});
```

### From Outside (Your Local PC)

**Use the VPS IP:**
```bash
DB_HOST=72.61.20.94  # ← Public IP
DB_PORT=5432
```

**Why different?**
- Inside Docker: Use container names
- Outside Docker: Use public IP

---

## Architecture Overview

```
Internet → Nginx (Port 80/443) → Your Apps (Docker Containers)
                                       ↓
                              Shared Services (Postgres, Redis)
```

---

## Flow 1: Deploy a New Node.js Application

### Step 1: Create App Directory Structure

```bash
cd ~/apps
mkdir my-new-app
cd my-new-app
```

### Step 2: Create Dockerfile

```bash
nano Dockerfile
```

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

### Step 3: Create docker-compose.yml

```bash
nano docker-compose.yml
```

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: my-new-app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: shared-postgres
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASS: wvlAZUDdnEdjpuxEVSZEJkYFwAYJhDEf
      DB_NAME: my_app_db
      REDIS_HOST: shared-redis
      REDIS_PORT: 6379
    ports:
      - "3001:3000"  # External:Internal
    networks:
      - shared_default
    depends_on:
      - db-setup

  # Helper service to create database
  db-setup:
    image: postgres:16-alpine
    networks:
      - shared_default
    environment:
      PGPASSWORD: wvlAZUDdnEdjpuxEVSZEJkYFwAYJhDEf
    entrypoint: >
      sh -c "
        until pg_isready -h shared-postgres -U postgres; do
          echo 'Waiting for postgres...';
          sleep 2;
        done;
        psql -h shared-postgres -U postgres -tc \"SELECT 1 FROM pg_database WHERE datname = 'my_app_db'\" | grep -q 1 || 
        psql -h shared-postgres -U postgres -c 'CREATE DATABASE my_app_db';
        echo 'Database ready';
      "

networks:
  shared_default:
    external: true
```

### Step 4: Deploy the App

```bash
# Build and start
docker compose up -d

# Check logs
docker compose logs -f app

# Verify it's running
curl http://localhost:3001
```

### Step 5: Add Nginx Reverse Proxy

```bash
nano ~/shared/nginx/conf.d/my-new-app.conf
```

```nginx
server {
    listen 80;
    server_name myapp.example.com;

    location / {
        proxy_pass http://172.17.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 6: Reload Nginx

```bash
docker exec shared-nginx nginx -s reload
```

**Done! Your app is live at myapp.example.com** ✅

---

## Flow 2: Add a New Database for an App

### Option A: Use Shared PostgreSQL (Recommended)

```bash
# Create new database
docker exec -it shared-postgres psql -U postgres -c "CREATE DATABASE new_app_db;"

# Verify
docker exec -it shared-postgres psql -U postgres -c "\l"
```

**In your app's docker-compose.yml:**
```yaml
environment:
  DB_NAME: new_app_db
```

### Option B: Dedicated PostgreSQL Container (If Needed)

```bash
cd ~/apps/my-app
nano docker-compose.yml
```

```yaml
services:
  app:
    # ... your app config
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    container_name: my-app-postgres
    environment:
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: myapp_db
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
    networks:
      - default

networks:
  default:
```

**When to use dedicated DB:**
- App needs specific PostgreSQL version
- App needs heavy isolation
- App has unique PostgreSQL extensions

---

## Flow 3: Add Redis for an App

### Option A: Use Shared Redis (Recommended)

**In your app's docker-compose.yml:**
```yaml
environment:
  REDIS_HOST: shared-redis
  REDIS_PORT: 6379
networks:
  - shared_default
```

**In your Node.js code:**
```javascript
const redis = require('redis');
const client = redis.createClient({
  host: 'shared-redis',
  port: 6379
});
```

### Option B: Dedicated Redis (If Needed)

```yaml
services:
  app:
    # ... your app
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    container_name: my-app-redis
    volumes:
      - ./redis-data:/data
```

---

## Flow 4: CI/CD Deployment Process

### Step 1: Push Code to GitHub

```bash
git add .
git commit -m "Deploy to VPS"
git push origin main
```

### Step 2: GitHub Actions Auto-Deploy

**.github/workflows/deploy.yml** in your repo:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: 72.61.20.94
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ~/apps/my-new-app
            git pull origin main
            docker compose down
            docker compose up -d --build
            docker system prune -f
```

### Step 3: Manual Deployment Script

```bash
nano ~/scripts/deploy.sh
```

```bash
#!/bin/bash
APP_NAME=$1

if [ -z "$APP_NAME" ]; then
    echo "Usage: ./deploy.sh <app-name>"
    exit 1
fi

echo "🚀 Deploying $APP_NAME..."

cd ~/apps/$APP_NAME || exit

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build

# Cleanup
docker system prune -f

echo "✅ $APP_NAME deployed successfully!"
docker compose ps
```

```bash
chmod +x ~/scripts/deploy.sh
```

**Deploy any app:**
```bash
~/scripts/deploy.sh my-new-app
```

---

## Flow 5: Scaling Pattern

### Vertical Scaling (Single Server)

**Add more apps on same VPS:**

```
~/apps/
├── app-1/          Port 3001 → myapp1.com
├── app-2/          Port 3002 → myapp2.com
├── app-3/          Port 3003 → myapp3.com
└── app-4/          Port 3004 → myapp4.com
```

All share the same Postgres and Redis.

### Horizontal Scaling (Multiple Instances)

**Run multiple instances of same app:**

```yaml
# docker-compose.yml
services:
  app-1:
    build: .
    ports:
      - "3001:3000"
  
  app-2:
    build: .
    ports:
      - "3002:3000"
  
  app-3:
    build: .
    ports:
      - "3003:3000"
```

**Nginx load balancing:**
```nginx
upstream my_app {
    server 172.17.0.1:3001;
    server 172.17.0.1:3002;
    server 172.17.0.1:3003;
}

server {
    listen 80;
    location / {
        proxy_pass http://my_app;
    }
}
```

---

## Flow 6: Add SSL Certificates

### Step 1: Install Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### Step 2: Get Certificate

```bash
certbot --nginx -d myapp.example.com
```

### Step 3: Auto-Renewal

```bash
# Test renewal
certbot renew --dry-run

# Renewal happens automatically via systemd timer
systemctl status certbot.timer
```

---

## Flow 7: Monitoring & Logs

### View App Logs

```bash
# Live logs
cd ~/apps/my-app
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Specific service
docker compose logs -f app
```

### Check Resource Usage

```bash
# All containers
docker stats

# Specific container
docker stats my-new-app
```

### Health Checks

```bash
nano ~/scripts/health-check.sh
```

```bash
#!/bin/bash

echo "🏥 Health Check Started..."

# Check shared services
docker exec shared-postgres pg_isready -U postgres || echo "❌ Postgres DOWN"
docker exec shared-redis redis-cli ping | grep -q PONG || echo "❌ Redis DOWN"

# Check apps
for app in ~/apps/*/; do
    app_name=$(basename "$app")
    cd "$app"
    if [ -f "docker-compose.yml" ]; then
        docker compose ps | grep -q "Up" || echo "❌ $app_name DOWN"
    fi
done

echo "✅ Health Check Complete"
```

---

## Complete Workflow Example

### Scenario: Deploy New E-commerce App

```bash
# 1. Create app directory
cd ~/apps
mkdir ecommerce-api
cd ecommerce-api

# 2. Clone your code
git clone https://github.com/yourname/ecommerce-api.git .

# 3. Create Dockerfile
cat > Dockerfile <<EOF
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
EOF

# 4. Create docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'
services:
  app:
    build: .
    container_name: ecommerce-api
    restart: unless-stopped
    environment:
      DB_HOST: shared-postgres
      DB_NAME: ecommerce_db
      REDIS_HOST: shared-redis
    ports:
      - "3005:3000"
    networks:
      - shared_default
networks:
  shared_default:
    external: true
EOF

# 5. Create database
docker exec -it shared-postgres psql -U postgres -c "CREATE DATABASE ecommerce_db;"

# 6. Deploy
docker compose up -d

# 7. Add Nginx config
cat > ~/shared/nginx/conf.d/ecommerce.conf <<EOF
server {
    listen 80;
    server_name api.ecommerce.com;
    location / {
        proxy_pass http://172.17.0.1:3005;
        proxy_set_header Host \$host;
    }
}
EOF

# 8. Reload Nginx
docker exec shared-nginx nginx -s reload

# 9. Test
curl http://api.ecommerce.com

# 10. Get SSL
certbot --nginx -d api.ecommerce.com
```

**Done! App is live with SSL** 🚀

---

## Quick Reference Commands

```bash
# Deploy new app
cd ~/apps/<app-name>
docker compose up -d

# Update app
git pull && docker compose up -d --build

# View logs
docker compose logs -f

# Restart app
docker compose restart

# Stop app
docker compose down

# Add database
docker exec -it shared-postgres psql -U postgres -c "CREATE DATABASE dbname;"

# Reload Nginx
docker exec shared-nginx nginx -s reload

# Check all services
docker ps
```

---

## Summary: The Complete Flow

1. **Create** app directory in `~/apps/`
2. **Add** Dockerfile + docker-compose.yml
3. **Create** database if needed
4. **Deploy** with `docker compose up -d`
5. **Configure** Nginx reverse proxy
6. **Add** SSL certificate
7. **Setup** CI/CD for auto-deployment
8. **Monitor** logs and health

**Repeat for every new application!**

## Deployed Applications

### CosmicForge Backend
- **Location**: `~/apps/cosmicforge_backend`
- **Domain**: https://backend.cosmicforge-healthnet.com
- **Port**: 3001
- **Container**: cosmicforge_backend
- **Database**: cosmicforge (shared PostgreSQL)
- **Redis**: shared-redis

**Commands:**
```bash
# View logs
docker logs -f cosmicforge_backend

# Restart
cd ~/apps/cosmicforge_backend
docker compose restart

# Update from GitHub
cd ~/apps/cosmicforge_backend
git pull origin main
cd ..
docker compose up -d --build