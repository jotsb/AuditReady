#!/bin/bash
# =====================================================
# RESTORE DATABASE TO UNRAID SUPABASE
# =====================================================
# This script restores a Bolt database backup to your
# local Unraid Supabase instance
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  RESTORE DATABASE TO UNRAID${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Check if backup files are provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${RED}Usage: $0 <schema_backup.sql> <data_backup.sql>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 backups/bolt_database_backup_20250130_120000.sql backups/bolt_database_data_20250130_120000.sql"
    exit 1
fi

SCHEMA_BACKUP="$1"
DATA_BACKUP="$2"

# Check if files exist
if [ ! -f "$SCHEMA_BACKUP" ]; then
    echo -e "${RED}✗ Schema backup file not found: $SCHEMA_BACKUP${NC}"
    exit 1
fi

if [ ! -f "$DATA_BACKUP" ]; then
    echo -e "${RED}✗ Data backup file not found: $DATA_BACKUP${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found schema backup: $SCHEMA_BACKUP"
echo -e "${GREEN}✓${NC} Found data backup: $DATA_BACKUP"
echo ""

# Load Unraid Supabase configuration
if [ -f ".env.supabase.production" ]; then
    source .env.supabase.production
else
    echo -e "${RED}✗ .env.supabase.production not found${NC}"
    echo -e "${RED}  Make sure you're in the correct directory${NC}"
    exit 1
fi

# Set database connection info for Unraid
UNRAID_DB_HOST="${POSTGRES_HOST:-localhost}"
UNRAID_DB_PORT="${POSTGRES_PORT:-5432}"
UNRAID_DB_USER="postgres"
UNRAID_DB_NAME="${POSTGRES_DB:-postgres}"
UNRAID_DB_PASSWORD="${POSTGRES_PASSWORD}"

echo -e "${BLUE}Target Unraid Database:${NC}"
echo -e "  Host: ${UNRAID_DB_HOST}"
echo -e "  Port: ${UNRAID_DB_PORT}"
echo -e "  Database: ${UNRAID_DB_NAME}"
echo ""

# Confirm with user
echo -e "${YELLOW}⚠️  WARNING: This will REPLACE your Unraid database!${NC}"
echo -e "${YELLOW}   All existing data will be lost!${NC}"
echo ""
echo -n "Are you sure you want to continue? (yes/no): "
read CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Restore cancelled${NC}"
    exit 0
fi
echo ""

# Test connection
echo -e "${BLUE}Testing connection to Unraid database...${NC}"
if [ "$UNRAID_DB_HOST" = "db" ]; then
    # Running inside Docker
    if ! PGPASSWORD="$UNRAID_DB_PASSWORD" docker exec supabase-db psql -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
        echo -e "${RED}✗ Failed to connect to Unraid database${NC}"
        exit 1
    fi
else
    # Running on host
    if ! PGPASSWORD="$UNRAID_DB_PASSWORD" psql -h "$UNRAID_DB_HOST" -p "$UNRAID_DB_PORT" -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
        echo -e "${RED}✗ Failed to connect to Unraid database${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓${NC} Connected successfully!"
echo ""

# Drop and recreate public schema
echo -e "${BLUE}Dropping existing public schema...${NC}"
if [ "$UNRAID_DB_HOST" = "db" ]; then
    docker exec supabase-db psql -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" << EOF
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
EOF
else
    PGPASSWORD="$UNRAID_DB_PASSWORD" psql -h "$UNRAID_DB_HOST" -p "$UNRAID_DB_PORT" -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" << EOF
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
EOF
fi
echo -e "${GREEN}✓${NC} Schema dropped and recreated"
echo ""

# Restore schema
echo -e "${BLUE}Restoring database schema...${NC}"
if [ "$UNRAID_DB_HOST" = "db" ]; then
    cat "$SCHEMA_BACKUP" | docker exec -i supabase-db psql -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME"
else
    PGPASSWORD="$UNRAID_DB_PASSWORD" psql -h "$UNRAID_DB_HOST" -p "$UNRAID_DB_PORT" -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" -f "$SCHEMA_BACKUP"
fi
echo -e "${GREEN}✓${NC} Schema restored"
echo ""

# Restore data
echo -e "${BLUE}Restoring database data...${NC}"
if [ "$UNRAID_DB_HOST" = "db" ]; then
    cat "$DATA_BACKUP" | docker exec -i supabase-db psql -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME"
else
    PGPASSWORD="$UNRAID_DB_PASSWORD" psql -h "$UNRAID_DB_HOST" -p "$UNRAID_DB_PORT" -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" -f "$DATA_BACKUP"
fi
echo -e "${GREEN}✓${NC} Data restored"
echo ""

# Verify restoration
echo -e "${BLUE}Verifying restoration...${NC}"
if [ "$UNRAID_DB_HOST" = "db" ]; then
    TABLE_COUNT=$(docker exec supabase-db psql -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
else
    TABLE_COUNT=$(PGPASSWORD="$UNRAID_DB_PASSWORD" psql -h "$UNRAID_DB_HOST" -p "$UNRAID_DB_PORT" -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
fi
echo -e "${GREEN}✓${NC} Found ${TABLE_COUNT} tables in public schema"
echo ""

# Summary
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  RESTORE COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Restart Supabase services: docker-compose restart"
echo -e "2. Verify your data in the Supabase dashboard"
echo -e "3. Update your frontend .env file to point to Unraid"
echo ""
echo -e "${BLUE}Restore completed at: $(date)${NC}"
