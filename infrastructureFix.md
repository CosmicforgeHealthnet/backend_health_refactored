# CosmicForge Infrastructure Fixes — 2026-04-28

## Summary
Production outage resolved. Automated monitoring and daily database backups put in place.

---

## Root Cause of Outage

### 1. Redis Network Misconfiguration
`cosmic_backend_prod` was on `cosmic_network_prod` but `cosmic_redis_dev` was only on `cosmic_network_dev`. The backend uses `REDIS_URL=redis://redis:6379` and couldn't resolve the hostname `redis` — causing it to fail on startup and return null responses to the frontend.

**Fix:**
```bash
docker network disconnect cosmic_network_prod cosmic_redis_dev
docker network connect --alias redis cosmic_network_prod cosmic_redis_dev
```

### 2. Ghost Container Blocking Gateway Restart
`cosmic_gateway_prod` had exited with code 128 — `OCI runtime create failed: container with given ID already exists`. A stale container was stuck in the runtime, preventing the gateway from being recreated.

**Fix:**
```bash
docker rm -f cosmic_gateway_prod
```

### 3. Nginx Failing to Start — Upstream DNS Resolution
Nginx was resolving upstream hostnames (`cosmic_backend_prod`, `cosmic_brain_prod`) at boot time before Docker's internal DNS had registered them, causing an `emerg: host not found in upstream` error and a crash loop.

**Fix:** Removed static upstream blocks and switched to lazy DNS resolution using Docker's internal resolver in every location block:
```nginx
resolver 127.0.0.11 valid=10s;
set $backend "http://cosmic_backend_prod:5000";
proxy_pass $backend;
```

### 4. Certbot Volume Path Read-Only
The prod docker-compose was mounting `/var/www/certbot` which was read-only on the VPS.

**Fix:** Changed to a local path:
```yaml
- ./certbot:/var/www/certbot:ro
```

---

## Changes Made

### nginx.production.conf
- Removed static `upstream` blocks
- Added `resolver 127.0.0.11 valid=10s` and `set $backend` variable pattern to all proxy location blocks (health, AI, upload, main)

### docker-compose.prod.yml
- Changed certbot volume mount from `/var/www/certbot` to `./certbot`

---

## New Infrastructure — Watchdog Script

**Location:** `/root/cosmic-watchdog.sh`  
**Schedule:** Every 5 minutes via cron

### What it monitors and auto-recovers:

| Check | Action |
|---|---|
| Redis reachable from prod network | Reconnects with correct alias |
| Redis reachable from dev network | Reconnects with correct alias |
| `cosmic_gateway_prod` running | Removes ghost, restarts via compose |
| `cosmic_gateway_dev` running | Removes ghost, restarts via compose |
| `cosmic_backend_prod` health (port 5000) | Restarts container |
| `cosmic_backend_dev` health (port 5001) | Restarts container |
| `cosmic_gateway_prod` on correct network | Reconnects to `cosmic_network_prod` |
| `cosmic_gateway_dev` on correct network | Reconnects to `cosmic_network_dev` |
| `shared-postgres` running | Starts container |

**Log file:** `/var/log/cosmic-watchdog.log` (auto-rotated every 7 days)

---

## New Infrastructure — Database Backups

**Location:** `/root/cosmic-db-backup.sh`  
**Schedule:** Daily at 2:00 AM via cron  
**Backup directory:** `/root/backups/postgres/`  
**Retention:** 7 days

### Databases backed up:
- `cosmicforge`
- `cosmicforge_v2` ← production
- `cosmicforge_clean`
- `cosmicforge_old`
- `cosmicforge_backup1`
- `cosmicforge_backup2`

Backups are compressed with gzip (`.sql.gz`).

---

## Cron Jobs Registered

```
*/5 * * * * /root/cosmic-watchdog.sh
0 2 * * * /root/cosmic-db-backup.sh
```

---

## Notes
- `shared-postgres` had been stopped for 3 weeks — restarted and added to watchdog
- `cosmicforge_v2` is the active production database
- The `allergies` table in one of the legacy databases has a column numbering issue — non-critical, does not affect production