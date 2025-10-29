#!/bin/bash

##############################################################################
# Complete Supavisor Fix - Delete EVERYTHING including migrations
##############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

DOCKER_DIR="/mnt/user/appdata/auditproof/supabase-src/docker"

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║     COMPLETE SUPAVISOR FIX - NUCLEAR OPTION               ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This will:${NC}"
echo "  1. Stop all services"
echo "  2. Start database only"
echo "  3. Drop _supavisor schema AND migration tracking"
echo "  4. Delete encrypted tenant data"
echo "  5. Restart everything (Supavisor recreates clean)"
echo ""
read -p "Continue? (y/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

cd "$DOCKER_DIR"

echo -e "\n${YELLOW}Step 1: Stopping all services...${NC}"
docker compose down
echo -e "${GREEN}✓ Done${NC}"

echo -e "\n${YELLOW}Step 2: Starting database only...${NC}"
docker compose up -d db
sleep 8

for i in {1..30}; do
    if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo -e "\n${YELLOW}Step 3: Checking current _supavisor data...${NC}"
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
SELECT 'Tables:' as info, COUNT(*) FROM pg_tables WHERE schemaname = '_supavisor';
EOF

echo -e "\n${RED}Step 4: NUCLEAR DELETE...${NC}"
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
DROP SCHEMA IF EXISTS _supavisor CASCADE;
DELETE FROM supabase_migrations.schema_migrations WHERE version::text LIKE '%supavisor%' OR version >= 20240000000000;
SELECT 'Supavisor removed' as status;
EOF

echo -e "${GREEN}✓ Complete${NC}"

echo -e "\n${YELLOW}Step 5: Restarting all services...${NC}"
docker compose down
sleep 2
docker compose up -d

echo -e "\n${YELLOW}Waiting 20 seconds...${NC}"
for i in {1..20}; do echo -n "."; sleep 1; done
echo ""

echo -e "\n${YELLOW}Step 6: Checking Supavisor...${NC}"
sleep 3

if docker ps --format '{{.Names}}\t{{.Status}}' | grep supabase-pooler | grep -q "Up"; then
    echo -e "${GREEN}✓ Container running${NC}"
    echo -e "\n${CYAN}Last 30 log lines:${NC}"
    docker logs --tail 30 supabase-pooler
    
    if docker logs --tail 30 supabase-pooler 2>&1 | grep -q "Unknown cipher"; then
        echo -e "\n${RED}✗ STILL FAILING - Migrations recreating bad data${NC}"
        exit 1
    elif docker logs --tail 30 supabase-pooler 2>&1 | grep -q "Proxy started"; then
        echo -e "\n${GREEN}✓✓✓ SUCCESS! ✓✓✓${NC}"
    fi
else
    echo -e "${RED}✗ Not running${NC}"
    exit 1
fi
