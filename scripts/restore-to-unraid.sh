#!/bin/bash
# =====================================================
# RESTORE DATABASE TO UNRAID SUPABASE - COMPLETE
# =====================================================
# This script restores a complete Bolt database backup
# to your local Unraid Supabase instance
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  RESTORE DATABASE TO UNRAID - COMPLETE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <complete_backup.sql>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 backups/bolt_complete_backup_20250130_120000.sql"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}✗ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found backup file: $BACKUP_FILE"
echo ""

# Load Unraid Supabase configuration
if [ -f ".env.supabase.production" ]; then
    set -a
    source .env.supabase.production
    set +a
else
    echo -e "${RED}✗ .env.supabase.production not found${NC}"
    echo -e "${RED}  Make sure you're in the correct directory${NC}"
    exit 1
fi

# Set database connection info for Unraid
UNRAID_DB_HOST="${POSTGRES_HOST:-db}"
UNRAID_DB_PORT="${POSTGRES_PORT:-5432}"
UNRAID_DB_USER="postgres"
UNRAID_DB_NAME="${POSTGRES_DB:-postgres}"
UNRAID_DB_PASSWORD="${POSTGRES_PASSWORD}"

# Detect if we're running on Unraid or elsewhere
if [ "$UNRAID_DB_HOST" = "db" ]; then
    CONNECTION_TYPE="docker"
    DOCKER_CONTAINER="supabase-db"
else
    CONNECTION_TYPE="host"
fi

echo -e "${BLUE}Target Unraid Database:${NC}"
echo -e "  Host: ${UNRAID_DB_HOST}"
echo -e "  Port: ${UNRAID_DB_PORT}"
echo -e "  Database: ${UNRAID_DB_NAME}"
echo -e "  Connection: ${CONNECTION_TYPE}"
echo ""

# Confirm with user
echo -e "${YELLOW}⚠️  WARNING: This will REPLACE your Unraid database!${NC}"
echo -e "${YELLOW}   All existing data will be PERMANENTLY LOST!${NC}"
echo ""
echo -e "${YELLOW}This restore includes:${NC}"
echo -e "  • All database extensions"
echo -e "  • Complete schema structure"
echo -e "  • All user authentication data"
echo -e "  • Storage bucket configuration"
echo -e "  • All application data"
echo ""
echo -n "Type 'yes' to confirm: "
read CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Restore cancelled${NC}"
    exit 0
fi
echo ""

# Function to execute SQL
execute_sql() {
    local sql="$1"
    if [ "$CONNECTION_TYPE" = "docker" ]; then
        echo "$sql" | docker exec -i "$DOCKER_CONTAINER" psql -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME"
    else
        PGPASSWORD="$UNRAID_DB_PASSWORD" psql -h "$UNRAID_DB_HOST" -p "$UNRAID_DB_PORT" -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" -c "$sql"
    fi
}

# Function to execute SQL file
execute_sql_file() {
    local file="$1"
    if [ "$CONNECTION_TYPE" = "docker" ]; then
        cat "$file" | docker exec -i "$DOCKER_CONTAINER" psql -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" 2>&1
    else
        PGPASSWORD="$UNRAID_DB_PASSWORD" psql -h "$UNRAID_DB_HOST" -p "$UNRAID_DB_PORT" -U "$UNRAID_DB_USER" -d "$UNRAID_DB_NAME" -f "$file" 2>&1
    fi
}

# Test connection
echo -e "${BLUE}Step 1/7: Testing connection...${NC}"
if ! execute_sql "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to connect to Unraid database${NC}"
    echo -e "${RED}  Please check:${NC}"
    echo -e "${RED}  - Supabase is running: docker-compose ps${NC}"
    echo -e "${RED}  - .env.supabase.production has correct password${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Connected successfully!"

# Verify Supabase is initialized
echo -e "${BLUE}Step 2/7: Verifying Supabase initialization...${NC}"
AUTH_SCHEMA=$(execute_sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'auth';" 2>/dev/null | grep -E '^[0-9]+$' | head -1 || echo "0")
STORAGE_SCHEMA=$(execute_sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'storage';" 2>/dev/null | grep -E '^[0-9]+$' | head -1 || echo "0")

if [ "$AUTH_SCHEMA" != "1" ] || [ "$STORAGE_SCHEMA" != "1" ]; then
    echo -e "${RED}✗ Supabase not properly initialized${NC}"
    echo -e "${RED}  Missing required schemas (auth: $AUTH_SCHEMA, storage: $STORAGE_SCHEMA)${NC}"
    echo -e "${YELLOW}  Run Supabase initialization first:${NC}"
    echo -e "${YELLOW}    docker-compose up -d${NC}"
    echo -e "${YELLOW}    Wait for all services to start (30-60 seconds)${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Supabase schemas present"

# Drop and recreate public schema
echo -e "${BLUE}Step 3/7: Dropping existing public schema...${NC}"
execute_sql "DROP SCHEMA IF EXISTS public CASCADE;" > /dev/null 2>&1
execute_sql "CREATE SCHEMA public;" > /dev/null 2>&1
execute_sql "GRANT ALL ON SCHEMA public TO postgres;" > /dev/null 2>&1
execute_sql "GRANT ALL ON SCHEMA public TO public;" > /dev/null 2>&1
echo -e "${GREEN}✓${NC} Public schema recreated"

# Clean storage schema tables (but keep schema)
echo -e "${BLUE}Step 4/7: Cleaning storage schema...${NC}"
execute_sql "TRUNCATE storage.objects CASCADE;" > /dev/null 2>&1 || true
execute_sql "TRUNCATE storage.buckets CASCADE;" > /dev/null 2>&1 || true
echo -e "${GREEN}✓${NC} Storage schema cleaned"

# Restore the backup
echo -e "${BLUE}Step 5/7: Restoring complete backup...${NC}"
echo -e "  This may take a few minutes..."

# Execute the backup file and capture output
RESTORE_OUTPUT=$(execute_sql_file "$BACKUP_FILE" 2>&1)
RESTORE_EXIT=$?

# Check for critical errors (ignore warnings about existing extensions)
CRITICAL_ERRORS=$(echo "$RESTORE_OUTPUT" | grep -i "error" | grep -v "already exists" | grep -v "extension" || true)

if [ -n "$CRITICAL_ERRORS" ]; then
    echo -e "${RED}✗ Restore encountered critical errors:${NC}"
    echo "$CRITICAL_ERRORS"
    echo ""
    echo -e "${YELLOW}Full output saved to: restore_errors.log${NC}"
    echo "$RESTORE_OUTPUT" > restore_errors.log
    exit 1
fi

echo -e "${GREEN}✓${NC} Backup restored successfully"

# Verify restoration
echo -e "${BLUE}Step 6/7: Verifying restoration...${NC}"

# Count tables
PUBLIC_TABLES=$(execute_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | grep -E '^[0-9]+$' | head -1 || echo "0")
echo -e "  ${GREEN}✓${NC} Found ${PUBLIC_TABLES} tables in public schema"

# Check critical tables
CRITICAL_TABLES=("profiles" "businesses" "receipts" "collections" "audit_logs")
MISSING_TABLES=()

for table in "${CRITICAL_TABLES[@]}"; do
    COUNT=$(execute_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" 2>/dev/null | grep -E '^[0-9]+$' | head -1 || echo "0")
    if [ "$COUNT" = "0" ]; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠ Warning: Missing critical tables: ${MISSING_TABLES[*]}${NC}"
else
    echo -e "  ${GREEN}✓${NC} All critical tables present"
fi

# Check for data
RECEIPTS_COUNT=$(execute_sql "SELECT COUNT(*) FROM receipts;" 2>/dev/null | grep -E '^[0-9]+$' | head -1 || echo "0")
BUSINESSES_COUNT=$(execute_sql "SELECT COUNT(*) FROM businesses;" 2>/dev/null | grep -E '^[0-9]+$' | head -1 || echo "0")
echo -e "  ${GREEN}✓${NC} Found ${RECEIPTS_COUNT} receipts"
echo -e "  ${GREEN}✓${NC} Found ${BUSINESSES_COUNT} businesses"

# Analyze tables for better performance
echo -e "${BLUE}Step 7/7: Optimizing database...${NC}"
execute_sql "ANALYZE;" > /dev/null 2>&1
echo -e "${GREEN}✓${NC} Database optimized"

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  RESTORE COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Restoration Summary:${NC}"
echo -e "  • Tables created: ${PUBLIC_TABLES}"
echo -e "  • Receipts restored: ${RECEIPTS_COUNT}"
echo -e "  • Businesses restored: ${BUSINESSES_COUNT}"
echo ""
echo -e "${YELLOW}Important Next Steps:${NC}"
echo ""
echo -e "1. ${BLUE}Restart Supabase services:${NC}"
echo -e "   docker-compose restart"
echo ""
echo -e "2. ${BLUE}Verify authentication works:${NC}"
echo -e "   - Try logging in with existing user credentials"
echo -e "   - Check that MFA settings are preserved"
echo ""
echo -e "3. ${BLUE}Update frontend configuration:${NC}"
echo -e "   - Edit .env file"
echo -e "   - Update VITE_SUPABASE_URL to your Unraid domain"
echo -e "   - Update VITE_SUPABASE_ANON_KEY (found in .env.supabase.production)"
echo ""
echo -e "4. ${BLUE}Migrate storage files (receipt images):${NC}"
echo -e "   - See documentation/BACKUP_RESTORE_GUIDE.md"
echo -e "   - Use Supabase CLI or manual upload"
echo ""
echo -e "5. ${BLUE}Test the application:${NC}"
echo -e "   - Access your Unraid domain"
echo -e "   - Verify receipts display correctly"
echo -e "   - Test uploading new receipts"
echo -e "   - Check team member access"
echo ""
echo -e "${GREEN}✓${NC} Database restoration complete!"
echo -e "${BLUE}Restore completed at: $(date)${NC}"
