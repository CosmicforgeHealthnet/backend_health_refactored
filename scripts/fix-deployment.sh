#!/bin/bash
# =============================================================================
# CosmicForge VPS Fix Script
# Run this ON THE SERVER as root: bash /root/fix-deployment.sh
# =============================================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; }

echo ""
echo "=========================================="
echo "  CosmicForge Deployment Repair Script"
echo "=========================================="
echo ""

# ── 1. SHOW CURRENT STATE ──────────────────────────────────────────────────
log "Current container state:"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true

echo ""
log "Current networks:"
docker network ls 2>/dev/null || true

echo ""
log "Ports in use:"
ss -tlnp | grep -E '80|443|5000|5001' || true

# ── 2. LOCATE WORKING DIRECTORY ON SERVER ─────────────────────────────────
DEV_DIR=""
PROD_DIR=""
for d in /root/cosmic-dev /root/cosmic-development /root/apps/cosmic-dev; do
  [ -d "$d" ] && DEV_DIR="$d" && break
done
for d in /root/cosmic-production /root/cosmic-prod /root/apps/cosmic-production; do
  [ -d "$d" ] && PROD_DIR="$d" && break
done

log "Dev directory:  ${DEV_DIR:-NOT FOUND}"
log "Prod directory: ${PROD_DIR:-NOT FOUND}"

# ── 3. STOP ANY STUCK HOST-LEVEL WEB SERVERS ─────────────────────────────
log "Stopping any host-level nginx/apache..."
systemctl stop nginx apache2 2>/dev/null && warn "Host nginx/apache was running - stopped it" || true

# ── 4. FIX DEV CONTAINERS ─────────────────────────────────────────────────
echo ""
echo "------------------------------------------"
echo " FIXING DEV ENVIRONMENT"
echo "------------------------------------------"

# Create dev network if missing
docker network create cosmic_network_dev 2>/dev/null && ok "Created cosmic_network_dev" || ok "cosmic_network_dev already exists"

# Check if dev backend is healthy
DEV_STATUS=$(docker inspect cosmic_backend_dev --format '{{.State.Status}}' 2>/dev/null || echo "missing")
log "cosmic_backend_dev status: $DEV_STATUS"

if [ "$DEV_STATUS" = "missing" ]; then
  err "cosmic_backend_dev does not exist! You need to trigger a GitHub Actions deploy on the 'dev' branch."
  echo "   → Go to GitHub → Actions → 'Deploy to Development' → Run workflow (branch: dev)"
elif [ "$DEV_STATUS" = "exited" ] || [ "$DEV_STATUS" = "created" ]; then
  warn "cosmic_backend_dev is stopped. Attempting restart..."
  docker start cosmic_backend_dev && ok "Started cosmic_backend_dev" || err "Could not start - check logs below"
  sleep 5
  docker logs cosmic_backend_dev --tail=30 2>&1
elif [ "$DEV_STATUS" = "running" ]; then
  ok "cosmic_backend_dev is running"
  log "Last 20 log lines:"
  docker logs cosmic_backend_dev --tail=20 2>&1
fi

# Check other dev containers
for container in cosmic_brain_dev cosmic_redis_dev cosmic_gateway_dev; do
  STATUS=$(docker inspect $container --format '{{.State.Status}}' 2>/dev/null || echo "missing")
  if [ "$STATUS" = "exited" ]; then
    warn "$container was stopped - restarting..."
    docker start $container && ok "Restarted $container" || err "Failed to restart $container"
  elif [ "$STATUS" = "missing" ]; then
    warn "$container not found - needs full dev re-deploy"
  else
    ok "$container: $STATUS"
  fi
done

# Ensure dev containers are on the dev network
for container in cosmic_backend_dev cosmic_brain_dev cosmic_redis_dev cosmic_gateway_dev; do
  STATUS=$(docker inspect $container --format '{{.State.Status}}' 2>/dev/null || echo "missing")
  if [ "$STATUS" = "running" ]; then
    docker network connect cosmic_network_dev $container 2>/dev/null && \
      ok "Connected $container to cosmic_network_dev" || \
      ok "$container already on cosmic_network_dev"
  fi
done

# ── 5. FIX PROD GATEWAY ────────────────────────────────────────────────────
echo ""
echo "------------------------------------------"
echo " FIXING PROD GATEWAY / NGINX"
echo "------------------------------------------"

GATEWAY_STATUS=$(docker inspect cosmic_gateway_prod --format '{{.State.Status}}' 2>/dev/null || echo "missing")
log "cosmic_gateway_prod status: $GATEWAY_STATUS"

if [ "$GATEWAY_STATUS" = "missing" ]; then
  err "cosmic_gateway_prod not found - you need to trigger a prod GitHub Actions deploy."
  echo "   → Go to GitHub → Actions → 'Deploy to Production' → Run workflow (branch: main)"
elif [ "$GATEWAY_STATUS" = "exited" ]; then
  warn "Prod gateway is stopped. Restarting..."
  docker start cosmic_gateway_prod && ok "Restarted cosmic_gateway_prod" || err "Could not restart gateway"
  sleep 3
elif [ "$GATEWAY_STATUS" = "running" ]; then
  ok "cosmic_gateway_prod is running"
fi

# --- KEY FIX: Connect prod gateway to dev network so dev-api routing works ---
if docker inspect cosmic_gateway_prod &>/dev/null; then
  log "Connecting cosmic_gateway_prod to cosmic_network_dev..."
  docker network connect cosmic_network_dev cosmic_gateway_prod 2>/dev/null && \
    ok "Connected prod gateway to cosmic_network_dev (dev-api routing now works!)" || \
    ok "Prod gateway already connected to cosmic_network_dev"

  log "Reloading nginx config inside gateway..."
  docker exec cosmic_gateway_prod nginx -s reload 2>/dev/null && ok "Nginx reloaded" || warn "Nginx reload failed - check gateway logs"
fi

# ── 6. CHECK PROD BACKEND ──────────────────────────────────────────────────
echo ""
echo "------------------------------------------"
echo " CHECKING PROD BACKEND"
echo "------------------------------------------"

PROD_STATUS=$(docker inspect cosmic_backend_prod --format '{{.State.Status}}' 2>/dev/null || echo "missing")
log "cosmic_backend_prod status: $PROD_STATUS"

if [ "$PROD_STATUS" = "exited" ]; then
  warn "Prod backend is stopped. Restarting..."
  docker start cosmic_backend_prod && ok "Restarted cosmic_backend_prod" || err "Could not restart prod backend"
  sleep 5
  docker logs cosmic_backend_prod --tail=20 2>&1
elif [ "$PROD_STATUS" = "running" ]; then
  ok "cosmic_backend_prod is running"
fi

# ── 7. WAIT AND HEALTH CHECK ───────────────────────────────────────────────
echo ""
echo "------------------------------------------"
echo " HEALTH CHECKS"
echo "------------------------------------------"

log "Waiting 10 seconds for containers to stabilize..."
sleep 10

log "Testing production API..."
PROD_HEALTH=$(curl -sk --connect-timeout 10 --max-time 15 https://api.cosmicforge-healthnet.com/health 2>&1 || echo "FAILED")
if echo "$PROD_HEALTH" | grep -q "version\|ok\|healthy\|OK"; then
  ok "PROD API is UP: $PROD_HEALTH"
else
  err "PROD API not responding: $PROD_HEALTH"
  docker logs cosmic_backend_prod --tail=30 2>&1 | head -40
fi

log "Testing dev API..."
DEV_HEALTH=$(curl -sk --connect-timeout 10 --max-time 15 https://dev-api.cosmicforge-healthnet.com/health 2>&1 || echo "FAILED")
if echo "$DEV_HEALTH" | grep -q "version\|ok\|healthy\|OK"; then
  ok "DEV API is UP: $DEV_HEALTH"
else
  err "DEV API not responding: $DEV_HEALTH"
  warn "Checking if dev backend is reachable directly from gateway..."
  docker exec cosmic_gateway_prod wget -qO- http://cosmic_backend_dev:5000/health 2>&1 || true
  echo ""
  warn "Recent dev backend logs:"
  docker logs cosmic_backend_dev --tail=40 2>&1 || echo "Could not get dev logs"
fi

# ── 8. FINAL STATUS ───────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo " FINAL CONTAINER STATUS"
echo "=========================================="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "name=cosmic_"

echo ""
echo "=========================================="
echo " DONE"
echo "=========================================="
echo ""
echo "If dev API is still failing, check the .env.dev file:"
echo "  ls -la /root/cosmic-dev/.env.dev"
echo "  tail -5 /root/cosmic-dev/.env.dev"
echo ""
echo "Or re-trigger the GitHub Actions deploy on the 'dev' branch."
