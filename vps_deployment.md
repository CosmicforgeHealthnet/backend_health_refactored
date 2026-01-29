# Complete VPS Deployment Guide: Docker, Nginx, SSL & DNS

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Why Docker](#why-docker)
4. [DNS Configuration](#dns-configuration)
5. [SSL Certificate Generation](#ssl-certificate-generation)
6. [Docker Networking Issues & Solutions](#docker-networking-issues--solutions)
7. [Nginx Reverse Proxy Configuration](#nginx-reverse-proxy-configuration)
8. [Step-by-Step Summary](#step-by-step-summary)

---

## Overview

You deployed a Node.js application to a VPS and made it accessible via a custom subdomain (`api.cosmicforge-healthnet.com`) with HTTPS encryption. The deployment involved:

- A VPS server at IP `72.61.20.94`
- A cPanel domain hosted elsewhere (`cosmicforge-healthnet.com`)
- Docker containers running your Node.js app and Nginx
- SSL certificates for secure HTTPS communication
- DNS configuration to route traffic correctly

---

## Architecture

### Before Deployment
```
Your Local Machine
    ↓
cPanel Server (main domain)
    ↓
Separate VPS (where you want to host the API)
```

### After Deployment
```
Internet User
    ↓
Request: https://api.cosmicforge-healthnet.com
    ↓
DNS Resolution (points to VPS IP: 72.61.20.94)
    ↓
VPS Server (72.61.20.94)
    ├─→ Nginx Container (reverse proxy on port 80/443)
    │   └─→ Routes traffic based on domain/path
    │
    └─→ Node.js App Container (running on port 5000)
        └─→ Your CosmicForge Health Backend API
```

---

## Why Docker

### What is Docker?

Docker is a containerization technology that packages your application with all its dependencies into an isolated environment called a "container."

### Why We Used Docker for This Deployment

**1. Isolation**
- Your Node.js app runs in its own isolated container
- Nginx runs in a separate container
- They don't interfere with each other
- System libraries and dependencies are contained

**2. Easy Management**
```bash
# Without Docker - manage Nginx manually
systemctl stop nginx
systemctl start nginx

# With Docker - manage containers
docker stop shared-nginx
docker start shared-nginx
```

**3. Network Isolation**
- Containers can communicate via Docker networks
- Can run multiple apps on the same VPS without port conflicts
- Each container gets its own IP address on the network

**4. Consistency**
- Same setup works on your laptop, staging, and production
- Easier to scale to multiple servers

**5. Multiple Services**
You're running:
- `shared-nginx` (Nginx reverse proxy)
- `cosmicforge_health_backend` (Your Node.js app)
- `shared-postgres` (Database)
- `shared-redis` (Caching)
- Multiple healthcare microservices

Without Docker, managing all these would be complicated.

### Docker vs Direct Installation

**Direct Installation on VPS:**
```bash
apt install nodejs npm nginx postgresql redis
# All running on the same system, competing for resources
```

**With Docker:**
```bash
# Each service in its own container
docker run nginx:alpine
docker run node:20
docker run postgres:16
# Each can be managed independently
```

---

## DNS Configuration

### What is DNS?

DNS (Domain Name System) translates human-readable domain names to IP addresses.

```
You type: api.cosmicforge-healthnet.com
    ↓
DNS lookup
    ↓
Returns: 72.61.20.94 (your VPS IP)
    ↓
Browser connects to VPS
```

### What We Did

**Step 1: Created A Record in cPanel**

An A record maps a domain name to an IP address.

In cPanel Zone Editor, we added:
```
Host Name: api
Type: A
Value: 72.61.20.94
TTL: 3600
```

This creates: `api.cosmicforge-healthnet.com` → `72.61.20.94`

**Why this works:**
- `api` is the subdomain
- `.cosmicforge-healthnet.com` is the domain you already own
- `72.61.20.94` is your VPS IP
- TTL (Time To Live) = how long DNS servers cache this record (3600 seconds = 1 hour)

**Why it took time to propagate:**
- DNS changes don't happen instantly
- DNS servers worldwide cache the old record
- It can take 5-30 minutes for all DNS servers to update
- We tested with `nslookup api.cosmicforge-healthnet.com` to verify

### Testing DNS Resolution

```bash
# On your local machine
nslookup api.cosmicforge-healthnet.com
# Output should show: 72.61.20.94

# Or
ping api.cosmicforge-healthnet.com
# Should connect to 72.61.20.94
```

---

## SSL Certificate Generation

### What is SSL/TLS?

SSL/TLS encrypts communication between your browser and the server.

```
Without SSL:
Browser → [PLAIN TEXT] → Server (anyone can intercept)

With SSL:
Browser → [ENCRYPTED] → Server (only they can read)
```

### Why We Needed It

Modern browsers show a warning for non-HTTPS websites. Users won't trust your API without HTTPS.

### How We Generated the Certificate

**Option 1: Webroot Method (Initially Failed)**
```bash
certbot certonly --webroot -w /var/www/certbot -d api.cosmicforge-healthnet.com
```
This method:
- Places a temporary file in `/var/www/certbot`
- Let's Encrypt downloads it to verify you own the domain
- Issues the certificate

**Why it failed:** Nginx config wasn't correctly serving the challenge files, and the Nginx webroot wasn't properly mounted.

**Option 2: DNS Method (Worked)**
```bash
certbot certonly --manual --preferred-challenges=dns -d api.cosmicforge-healthnet.com
```

This method:
1. Certbot generates a random token
2. You add a TXT record to DNS with the token
3. Let's Encrypt checks the TXT record
4. If it matches, they issue the certificate

**DNS Challenge Process:**
```
1. Certbot: "Prove you own api.cosmicforge-healthnet.com"
2. Certbot generates: EqRFs4tyHBv00KvoC-JTdSv3Yz2vW03GCW7DqoVDpig
3. You add TXT record:
   _acme-challenge.api.cosmicforge-healthnet.com → EqRFs4tyHBv00KvoC-JTdSv3Yz2vW03GCW7DqoVDpig
4. Let's Encrypt verifies the TXT record exists
5. Certificate issued! ✅
```

### Certificate Files Created

```
/etc/letsencrypt/live/api.cosmicforge-healthnet.com/
├── fullchain.pem      (your certificate chain)
├── privkey.pem        (your private key - keep secret!)
└── cert.pem           (just your certificate)
```

These files are referenced in your Nginx config:
```nginx
ssl_certificate /etc/letsencrypt/live/api.cosmicforge-healthnet.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.cosmicforge-healthnet.com/privkey.pem;
```

---

## Docker Networking Issues & Solutions

### The Problem

You had multiple Docker containers running on your VPS:
```bash
docker ps

shared-nginx (Nginx reverse proxy)
cosmicforge_health_backend (Your Node.js app)
shared-postgres (Database)
shared-redis (Caching)
healthcare-* (Other microservices)
```

### The Issue We Encountered

When Nginx tried to connect to your app, it failed with a 504 Gateway Timeout.

**Root Cause:** The containers were on different Docker networks.

### Understanding Docker Networks

Docker uses networks to control how containers communicate.

**Network 1: `refactored_backend_healthcare-network`**
- Contains: `shared-nginx`, other healthcare microservices
- IP Range: `172.20.0.0/16`

**Network 2: `shared_app-network`**
- Contains: `cosmicforge_health_backend` (initially)
- IP Range: `172.21.0.0/16`

**Problem:**
```
Network 1: shared-nginx (172.20.0.2)
Network 2: cosmicforge_health_backend (172.21.0.3)
          ↓
         They can't communicate!
```

### Why They Couldn't Communicate

Docker networks are isolated by default:
- Containers on different networks can't see each other
- Even though they're on the same VPS
- It's like two separate office buildings with no bridge

### The Solution

**Connect the app container to the Nginx network:**

```bash
docker network connect refactored_backend_healthcare-network cosmicforge_health_backend
```

**What this does:**
```
Before:
Network 1: shared-nginx
Network 2: cosmicforge_health_backend

After:
Network 1: shared-nginx + cosmicforge_health_backend
Network 2: cosmicforge_health_backend
          ↓
       Both networks!
```

**Result:** The app now has two IP addresses:
- `172.20.0.3` (on healthcare-network, same as Nginx)
- `172.21.0.3` (on shared_app-network, original)

### Verification

```bash
# Check if containers can communicate
docker exec shared-nginx curl http://172.20.0.3:5000

# Response: JSON welcome message ✅
```

### Why This Matters

```bash
# Without network connection
curl http://172.21.0.3:5000
# Timeout after 21 seconds ❌

# With network connection
curl http://172.20.0.3:5000
# Response in milliseconds ✅
```

---

## Nginx Reverse Proxy Configuration

### What is a Reverse Proxy?

A reverse proxy is a server that sits between clients and your backend.

```
Traditional Setup:
Client → Your App (port 3000) 
         (exposed to internet - not secure)

Reverse Proxy Setup:
Client → Nginx (port 80/443, public)
         → Your App (port 5000, hidden)
         
Benefits:
- Your app is not directly exposed
- Nginx handles SSL/TLS
- Can load balance across multiple app instances
- Can cache responses
- Can rewrite URLs
```

### Our Nginx Configuration

```nginx
# HTTP - redirect to HTTPS
server {
    listen 80;
    server_name api.cosmicforge-healthnet.com;
    
    # Allow Let's Encrypt challenges
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS - actual reverse proxy
server {
    listen 443 ssl;
    server_name api.cosmicforge-healthnet.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.cosmicforge-healthnet.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.cosmicforge-healthnet.com/privkey.pem;
    
    # Proxy settings
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    location / {
        # Forward to your app on the same Docker network
        proxy_pass http://172.20.0.3:5000;
        
        # HTTP/2 settings
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Pass original request info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Configuration Breakdown

**HTTP Block (Port 80):**
- Listens for unencrypted HTTP requests
- Serves Let's Encrypt certificate challenges (for renewal)
- Redirects everything else to HTTPS

**HTTPS Block (Port 443):**
- Listens for encrypted HTTPS requests
- Uses SSL certificates
- Proxies requests to your Node.js app
- Sets timeouts (if app takes longer than 60s, timeout)
- Passes original request information

**Why We Pass Headers:**
```
Original Request: GET /api/users from 192.168.1.1
                              ↓
    Nginx (as a proxy) makes new request to backend:
    GET /api/users from 172.20.0.2
                              ↓
    Backend sees: Request from 172.20.0.2 (wrong IP!)
                              ↓
    Solution: X-Forwarded-For header tells backend
    "Original request was from 192.168.1.1"
```

---

## Why Docker Commands Use `docker exec`

### Understanding the Problem

Your Nginx was **running inside a Docker container**, not directly on your VPS.

```
VPS Server (Ubuntu Linux)
    └── Docker
        └── Nginx Container
            └── nginx.conf, SSL certs, etc.
```

### Running Commands in Containers

**Commands on the VPS (host):**
```bash
# These run on the VPS itself
systemctl status nginx
apt install nginx
nginx -s reload
```

**Commands inside Docker containers:**
```bash
# These run INSIDE the container
docker exec shared-nginx nginx -s reload
docker exec shared-nginx certbot certonly ...
docker exec shared-nginx curl http://app:5000
```

### Why We Used `docker exec`

**Example: Checking if Nginx was running**

```bash
# Wrong - checks VPS Nginx (not running)
nginx -s reload
# Error: command not found

# Correct - reloads Nginx inside the container
docker exec shared-nginx nginx -s reload
# Works! Nginx reloaded inside the container
```

### Breaking Down `docker exec`

```bash
docker exec [OPTIONS] CONTAINER COMMAND
            |          |        |
            |          |        └─ Command to run inside container
            |          └────────── Container name/ID
            └──────────────────── Docker command
```

**Real examples:**

```bash
# Check Nginx logs inside container
docker exec shared-nginx tail /var/log/nginx/error.log

# Install package inside container
docker exec shared-nginx apk add certbot

# Test app connectivity from Nginx container
docker exec shared-nginx curl http://cosmicforge_health_backend:5000

# Copy certificate from container
docker exec shared-nginx cat /etc/letsencrypt/live/api.cosmicforge-healthnet.com/fullchain.pem
```

### Container vs Host Isolation

```
Host (VPS):
- Nginx NOT installed
- Certbot NOT installed
- Python NOT installed
- Contains: OS, Docker, Config files

Container (Nginx):
- Nginx IS installed
- Has SSL certificates mounted
- Has Nginx config mounted
- Alpine Linux inside
- 
When you run:
docker exec shared-nginx nginx -s reload
└─ Runs inside the Alpine Linux container
```

---

## Step-by-Step Summary

### 1. DNS Setup
```bash
# Add A record in cPanel Zone Editor
Host: api
Type: A
Value: 72.61.20.94
TTL: 3600

# Verify DNS propagation
nslookup api.cosmicforge-healthnet.com
# Should return: 72.61.20.94
```

### 2. Generate SSL Certificate
```bash
# Add TXT record for DNS challenge
_acme-challenge.api.cosmicforge-healthnet.com = EqRFs4tyHBv00KvoC-JTdSv3Yz2vW03GCW7DqoVDpig

# Generate certificate
certbot certonly --manual --preferred-challenges=dns -d api.cosmicforge-healthnet.com

# Certificate created at:
/etc/letsencrypt/live/api.cosmicforge-healthnet.com/fullchain.pem
/etc/letsencrypt/live/api.cosmicforge-healthnet.com/privkey.pem
```

### 3. Fix Docker Networking
```bash
# Container was on wrong network
docker ps
# Shows: cosmicforge_health_backend on shared_app-network

# Connect to Nginx network
docker network connect refactored_backend_healthcare-network cosmicforge_health_backend

# Verify
docker inspect cosmicforge_health_backend | grep '"Networks"'
# Should show both networks now
```

### 4. Configure Nginx Reverse Proxy
```bash
# Create config file
nano /root/shared/nginx/conf.d/api-cosmicforge.conf

# Add HTTP and HTTPS blocks (see config above)

# Reload Nginx inside container
docker exec shared-nginx nginx -s reload
```

### 5. Verify Everything
```bash
# Test DNS
nslookup api.cosmicforge-healthnet.com
# 72.61.20.94 ✅

# Test container connectivity
docker exec shared-nginx curl http://172.20.0.3:5000
# JSON response ✅

# Test HTTP redirect
curl -I http://api.cosmicforge-healthnet.com
# 301 redirect to HTTPS ✅

# Test HTTPS
curl -I https://api.cosmicforge-healthnet.com
# 200 OK with JSON response ✅
```

---

## Common Issues & Solutions

### Issue 1: 504 Gateway Timeout
**Cause:** Nginx can't reach your app container
**Solution:** Check Docker network connectivity
```bash
docker exec shared-nginx curl http://app-container:port
```

### Issue 2: Certificate Not Found
**Cause:** Certificate file path is wrong or doesn't exist
**Solution:** Verify certificate exists
```bash
ls -la /etc/letsencrypt/live/api.cosmicforge-healthnet.com/
```

### Issue 3: DNS Not Resolving
**Cause:** DNS hasn't propagated or A record is wrong
**Solution:** Clear DNS cache and verify A record
```bash
# Linux/Mac
sudo dscacheutil -flushcache

# Windows (PowerShell as Admin)
ipconfig /flushdns

# Verify A record
nslookup api.cosmicforge-healthnet.com
```

### Issue 4: Nginx Port Already in Use
**Cause:** Something else running on port 80/443
**Solution:** Find and stop conflicting service
```bash
lsof -i :80
lsof -i :443
# Shows what's using these ports
```

---

## Production Considerations

### 1. Certificate Renewal
Let's Encrypt certificates expire after 90 days.

```bash
# Manual renewal (before expiration)
certbot renew

# Automatic renewal (set up cron job)
certbot renew --quiet
```

### 2. Security Headers
Add to Nginx config for better security:
```nginx
add_header X-Content-Type-Options "nosniff";
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
```

### 3. Rate Limiting
Protect your API from abuse:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20;
```

### 4. Logging
Monitor what's happening:
```bash
docker exec shared-nginx tail -f /var/log/nginx/access.log
docker exec shared-nginx tail -f /var/log/nginx/error.log
```

### 5. Backups
Back up your SSL certificates:
```bash
tar -czf letsencrypt-backup.tar.gz /etc/letsencrypt/
```

---

## Summary

You successfully deployed a Node.js API to a VPS with:

✅ DNS configuration pointing to VPS  
✅ SSL/TLS encryption with Let's Encrypt  
✅ Nginx reverse proxy handling requests  
✅ Docker containers isolated and networked  
✅ HTTPS redirect and proper header forwarding  

The key learning: **Docker provides isolation and easy management**, but requires understanding **how containers network and communicate** with each other.

Your API is now accessible at: `https://api.cosmicforge-healthnet.com`