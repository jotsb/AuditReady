#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Fixing Supavisor ulimit Issue ===${NC}\n"

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found in current directory${NC}"
    echo "Please run this script from /mnt/user/appdata/auditproof/supabase-project"
    exit 1
fi

# Backup docker-compose.yml
echo -e "${GREEN}Creating backup...${NC}"
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)

# Check if supavisor already has cap_add
if grep -A 5 "supavisor:" docker-compose.yml | grep -q "cap_add:"; then
    echo -e "${YELLOW}supavisor already has cap_add configured${NC}"

    if grep -A 6 "supavisor:" docker-compose.yml | grep -q "SYS_RESOURCE"; then
        echo -e "${GREEN}SYS_RESOURCE already present, nothing to do${NC}"
        exit 0
    else
        echo -e "${YELLOW}Adding SYS_RESOURCE to existing cap_add${NC}"
        # Add SYS_RESOURCE to existing cap_add
        sed -i '/supavisor:/,/^  [a-z]/ { /cap_add:/a\      - SYS_RESOURCE
        }' docker-compose.yml
    fi
else
    echo -e "${GREEN}Adding cap_add with SYS_RESOURCE to supavisor service${NC}"

    # Find the supavisor service and add cap_add after the image line
    sed -i '/supavisor:/,/^  [a-z]/ {
        /image:.*supavisor/ a\    cap_add:\n      - SYS_RESOURCE
    }' docker-compose.yml
fi

echo -e "\n${GREEN}Configuration updated!${NC}\n"

# Show the change
echo -e "${YELLOW}Modified supavisor section:${NC}"
sed -n '/supavisor:/,/^  [a-z]/p' docker-compose.yml | head -n 15

echo -e "\n${YELLOW}Restarting supavisor...${NC}"
docker compose stop supavisor
docker compose rm -f supavisor
docker compose up -d supavisor

echo -e "\n${GREEN}Waiting for supavisor to start...${NC}"
sleep 5

# Check if it's running without errors
if docker compose ps supavisor | grep -q "Up"; then
    echo -e "\n${GREEN}✓ Supavisor is running!${NC}"

    # Check logs for the ulimit error
    if docker compose logs --tail=10 supavisor 2>&1 | grep -q "cannot modify limit"; then
        echo -e "${YELLOW}Warning: Still seeing ulimit errors in logs${NC}"
        echo "This might require Docker restart or host system changes"
    else
        echo -e "${GREEN}✓ No ulimit errors detected${NC}"
    fi
else
    echo -e "${RED}✗ Supavisor failed to start${NC}"
    echo -e "\nLast 20 log lines:"
    docker compose logs --tail=20 supavisor
    exit 1
fi

echo -e "\n${GREEN}Done!${NC}"
