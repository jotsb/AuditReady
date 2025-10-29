#!/bin/bash

##############################################################################
# Fix Supavisor Encryption Error - Standalone Script
#
# Run this if Supavisor keeps crashing with encryption errors after
# running the database rebuild script.
#
# Usage:
#   chmod +x fix-supavisor-only.sh
#   ./fix-supavisor-only.sh
#
##############################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DOCKER_DIR="/mnt/user/appdata/auditproof/supabase-src/docker"

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                            ║${NC}"
echo -e "${RED}║           FIX SUPAVISOR ENCRYPTION ERROR                   ║${NC}"
echo -e "${RED}║                                                            ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This script will:${NC}"
echo "  1. Stop all services"
echo "  2. Remove Supavisor Docker volumes"
echo "  3. Clear Supavisor database schema"
echo "  4. Restart all services (Supavisor will recreate fresh)"
echo ""
read -p "Continue? (y/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

cd "$DOCKER_DIR"

echo -e "\n${YELLOW}Step 1: Stopping all services...${NC}"
docker compose down
echo -e "${GREEN}✓ Services stopped${NC}"

echo -e "\n${YELLOW}Step 2: Checking for Supavisor volumes...${NC}"
SUPAVISOR_VOLUMES=$(docker volume ls -q | grep -i supavisor || true)
if [ -n "$SUPAVISOR_VOLUMES" ]; then
    echo -e "${RED}Found Supavisor volumes:${NC}"
    echo "$SUPAVISOR_VOLUMES"
    echo "$SUPAVISOR_VOLUMES" | while read volume; do
        echo -e "${YELLOW}  Removing: $volume${NC}"
        docker volume rm "$volume" || true
    done
    echo -e "${GREEN}✓ Volumes removed${NC}"
else
    echo -e "${GREEN}✓ No Supavisor volumes found${NC}"
fi

echo -e "\n${YELLOW}Step 3: Starting database only...${NC}"
docker compose up -d db
sleep 8

echo -e "${YELLOW}Waiting for database...${NC}"
for i in {1..30}; do
    if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo -e "\n${YELLOW}Step 4: Clearing Supavisor schema...${NC}"
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
-- Drop the entire _supavisor schema
DROP SCHEMA IF EXISTS _supavisor CASCADE;

-- Verify it's gone
SELECT COUNT(*) as supavisor_tables_remaining
FROM pg_tables
WHERE schemaname = '_supavisor';
EOF

echo -e "${GREEN}✓ Supavisor schema cleared${NC}"

echo -e "\n${YELLOW}Step 5: Stopping database...${NC}"
docker compose down
echo -e "${GREEN}✓ Database stopped${NC}"

echo -e "\n${YELLOW}Step 6: Starting all services...${NC}"
docker compose up -d
echo -e "${GREEN}✓ All services started${NC}"

echo -e "\n${YELLOW}Waiting for services to initialize (15 seconds)...${NC}"
for i in {1..15}; do
    echo -n "."
    sleep 1
done
echo ""

echo -e "\n${YELLOW}Step 7: Checking Supavisor status...${NC}"
sleep 5

if docker ps | grep -q "supabase-pooler"; then
    echo -e "${GREEN}✓ Supavisor container is running${NC}"

    echo -e "\n${YELLOW}Last 20 lines of Supavisor logs:${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    docker logs --tail 20 supabase-pooler
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"

    # Check for errors
    if docker logs --tail 20 supabase-pooler 2>&1 | grep -q "Unknown cipher or invalid key size"; then
        echo -e "\n${RED}✗ Supavisor still has encryption errors${NC}"
        echo -e "${YELLOW}⚠ The issue persists. You may need to run the full rebuild-database.sh script.${NC}"
        exit 1
    elif docker logs --tail 20 supabase-pooler 2>&1 | grep -q "Proxy started"; then
        echo -e "\n${GREEN}✓ Supavisor started successfully!${NC}"
        echo -e "${GREEN}✓ Fix complete!${NC}"
    else
        echo -e "\n${YELLOW}⚠ Supavisor status unclear. Check logs with:${NC}"
        echo -e "  ${BLUE}docker logs -f supabase-pooler${NC}"
    fi
else
    echo -e "${RED}✗ Supavisor container not running${NC}"
    echo -e "${YELLOW}Check all containers:${NC}"
    docker compose ps
    exit 1
fi

echo -e "\n${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Next Steps:${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "\n1. ${YELLOW}Monitor Supavisor logs:${NC}"
echo -e "   ${BLUE}docker logs -f supabase-pooler${NC}"
echo -e "\n2. ${YELLOW}Check all services:${NC}"
echo -e "   ${BLUE}cd $DOCKER_DIR${NC}"
echo -e "   ${BLUE}docker compose ps${NC}"
echo ""
