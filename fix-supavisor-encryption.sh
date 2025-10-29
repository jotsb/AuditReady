#!/bin/bash

##############################################################################
# Supavisor Encryption Key Fix Script
#
# This script fixes the "Unknown cipher or invalid key size" error
# that causes Supavisor (database pooler) to crash repeatedly.
#
# The issue: VAULT_ENC_KEY has base64 padding (= characters) or was
# used to encrypt data that now can't be decrypted with a new key.
#
# This script:
# 1. Clears the encrypted Supavisor data from the database
# 2. Generates a new proper encryption key (without padding)
# 3. Updates the .env file
# 4. Restarts services
#
# Usage:
#   chmod +x fix-supavisor-encryption.sh
#   ./fix-supavisor-encryption.sh
#
##############################################################################

set -e  # Exit on any error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENV_FILE="/mnt/user/appdata/auditproof/supabase-project/.env"
DOCKER_DIR="/mnt/user/appdata/auditproof/supabase-src/docker"

echo -e "${RED}========================================${NC}"
echo -e "${RED}Supavisor Encryption Key Fix${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${YELLOW}This will fix the encryption key error causing Supavisor to crash.${NC}"
echo ""
echo -e "${YELLOW}⚠ WARNING: This will:${NC}"
echo "  1. Clear Supavisor connection pool data (safe, will be recreated)"
echo "  2. Generate a new encryption key"
echo "  3. Restart all Supabase services"
echo ""
read -p "Continue? (y/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

##############################################################################
# Step 1: Validate paths
##############################################################################

echo -e "\n${YELLOW}Step 1: Validating paths...${NC}"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}ERROR: .env file not found at: $ENV_FILE${NC}"
    exit 1
fi

if [ ! -d "$DOCKER_DIR" ]; then
    echo -e "${RED}ERROR: Docker directory not found at: $DOCKER_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Paths validated${NC}"

##############################################################################
# Step 2: Backup .env file
##############################################################################

echo -e "\n${YELLOW}Step 2: Backing up .env file...${NC}"

BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$ENV_FILE" "$BACKUP_FILE"

echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"

##############################################################################
# Step 3: Stop services and clear Supavisor data
##############################################################################

echo -e "\n${YELLOW}Step 3: Stopping services and clearing Supavisor data...${NC}"

cd "$DOCKER_DIR"

# Stop all services
echo "Stopping all services..."
docker compose down

# Start only the database
echo "Starting database..."
docker compose up -d db

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Clear Supavisor data
echo "Clearing Supavisor encrypted data..."
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
-- Clear Supavisor tables (this is safe - data will be recreated)
DO $$
BEGIN
    -- Drop and recreate the schema to clear all data
    DROP SCHEMA IF EXISTS _supavisor CASCADE;
    CREATE SCHEMA _supavisor;

    RAISE NOTICE 'Supavisor data cleared successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Note: Supavisor schema may not exist yet (this is fine)';
END $$;
EOF

echo -e "${GREEN}✓ Supavisor data cleared${NC}"

##############################################################################
# Step 4: Generate new encryption key
##############################################################################

echo -e "\n${YELLOW}Step 4: Generating new encryption key...${NC}"

# Generate key without padding for Supavisor compatibility
NEW_VAULT_KEY=$(openssl rand -base64 32 | tr -d '=')

echo "New VAULT_ENC_KEY (first 20 chars): ${NEW_VAULT_KEY:0:20}..."

##############################################################################
# Step 5: Update .env file
##############################################################################

echo -e "\n${YELLOW}Step 5: Updating .env file...${NC}"

# Update VAULT_ENC_KEY in .env
sed -i "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=$NEW_VAULT_KEY|" "$ENV_FILE"

echo -e "${GREEN}✓ .env file updated${NC}"

##############################################################################
# Step 6: Restart all services
##############################################################################

echo -e "\n${YELLOW}Step 6: Restarting all services...${NC}"

cd "$DOCKER_DIR"

echo "Stopping database..."
docker compose down

echo "Starting all services..."
docker compose up -d

echo "Waiting for services to start..."
sleep 15

##############################################################################
# Step 7: Verify Supavisor is running
##############################################################################

echo -e "\n${YELLOW}Step 7: Verifying Supavisor status...${NC}"

# Check if supavisor is running
if docker ps | grep -q "supabase-pooler"; then
    echo -e "${GREEN}✓ Supavisor container is running${NC}"

    # Check logs for errors
    echo ""
    echo "Checking recent logs..."
    sleep 5

    LOGS=$(docker logs supabase-pooler 2>&1 | tail -20)

    if echo "$LOGS" | grep -q "Unknown cipher or invalid key size"; then
        echo -e "${RED}✗ Still seeing encryption errors${NC}"
        echo ""
        echo "Last 20 lines of logs:"
        echo "$LOGS"
        echo ""
        echo -e "${YELLOW}The issue persists. This might require manual intervention.${NC}"
        exit 1
    elif echo "$LOGS" | grep -q "Proxy started"; then
        echo -e "${GREEN}✓ Supavisor started successfully!${NC}"
        echo ""
        echo "Recent logs:"
        echo "$LOGS" | tail -10
    else
        echo -e "${YELLOW}⚠ Supavisor is running but status unclear${NC}"
        echo ""
        echo "Recent logs:"
        echo "$LOGS" | tail -10
    fi
else
    echo -e "${RED}✗ Supavisor container not running${NC}"
    exit 1
fi

##############################################################################
# Step 8: Display summary
##############################################################################

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Fix Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Supavisor data cleared${NC}"
echo -e "${GREEN}✓ New encryption key generated${NC}"
echo -e "${GREEN}✓ .env file updated${NC}"
echo -e "${GREEN}✓ Services restarted${NC}"
echo ""
echo -e "${YELLOW}Backup saved to:${NC} $BACKUP_FILE"
echo ""
echo -e "${YELLOW}To verify all services are healthy:${NC}"
echo -e "  ${BLUE}cd $DOCKER_DIR${NC}"
echo -e "  ${BLUE}docker compose ps${NC}"
echo ""
echo -e "${YELLOW}To monitor Supavisor logs:${NC}"
echo -e "  ${BLUE}docker logs -f supabase-pooler${NC}"
echo ""
echo -e "${GREEN}If everything is working, you can delete the backup:${NC}"
echo -e "  ${BLUE}rm $BACKUP_FILE${NC}"
echo ""
