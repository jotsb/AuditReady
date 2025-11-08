#!/bin/bash

# Clear Rate Limits Script
# This script clears rate limiting entries from the database

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Clear Rate Limits ===${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found${NC}"
    echo "Please run this script from the supabase-project directory"
    exit 1
fi

# Get database password from .env
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

echo "Clearing rate limit entries..."
echo ""

# Connect to database and clear rate limits
docker exec -it supabase-db psql -U postgres -d postgres <<-EOSQL
    -- Show current rate limit entries
    SELECT
        action_type,
        COUNT(*) as count,
        SUM(attempts) as total_attempts
    FROM rate_limit_attempts
    GROUP BY action_type;

    -- Clear all rate limit entries
    DELETE FROM rate_limit_attempts;

    -- Confirm deletion
    SELECT COUNT(*) as remaining_entries FROM rate_limit_attempts;
EOSQL

echo ""
echo -e "${GREEN}✓ Rate limits cleared successfully${NC}"
echo ""
echo "You can now resend invitation emails without rate limiting issues."
