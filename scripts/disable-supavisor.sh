#!/bin/bash

##############################################################################
# Disable Supavisor - Just don't use it
##############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

DOCKER_DIR="/mnt/user/appdata/auditproof/supabase-src/docker"

echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Disable Supavisor (Connection Pooler)${NC}"
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Supavisor provides connection pooling but is${NC}"
echo -e "${YELLOW}NOT required for Supabase to function.${NC}"
echo ""
echo -e "${GREEN}If you disable it:${NC}"
echo "  ✓ All other services work fine"
echo "  ✓ You connect directly to Postgres"
echo "  ✓ Slightly less efficient with many connections"
echo "  ✓ No more encryption errors"
echo ""
read -p "Disable Supavisor? (y/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

cd "$DOCKER_DIR"

echo -e "\n${YELLOW}Stopping services...${NC}"
docker compose down

echo -e "\n${YELLOW}Removing Supavisor from docker-compose.yml...${NC}"
if grep -q "supavisor:" docker-compose.yml; then
    # Create backup
    cp docker-compose.yml docker-compose.yml.backup
    
    # Comment out supavisor service
    sed -i '/^  supavisor:/,/^  [a-z]/{ /^  supavisor:/s/^/#/; /^  [a-z]/!s/^/#/ }' docker-compose.yml
    
    echo -e "${GREEN}✓ Supavisor disabled (backed up to docker-compose.yml.backup)${NC}"
else
    echo -e "${YELLOW}Supavisor already disabled${NC}"
fi

echo -e "\n${YELLOW}Starting services without Supavisor...${NC}"
docker compose up -d

echo -e "\n${YELLOW}Waiting for services...${NC}"
for i in {1..15}; do echo -n "."; sleep 1; done
echo ""

echo -e "\n${GREEN}✓ Services running without Supavisor${NC}"
echo -e "\n${CYAN}Check status:${NC} docker compose ps"
echo -e "${CYAN}To re-enable:${NC} cp docker-compose.yml.backup docker-compose.yml"
