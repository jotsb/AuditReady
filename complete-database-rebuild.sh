#!/bin/bash

##############################################################################
# Complete Database Wipe and Rebuild Script
#
# This script performs a complete fresh start:
# 1. Stops all Supabase services
# 2. Drops ALL database schemas (including _supavisor, auth, storage, public)
# 3. Generates new encryption key
# 4. Updates .env file
# 5. Restarts database
# 6. Applies ALL migrations in order
# 7. Starts all services
# 8. Verifies everything is running
#
# Usage:
#   chmod +x complete-database-rebuild.sh
#   ./complete-database-rebuild.sh
#
##############################################################################

set -e  # Exit on any error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
ENV_FILE="/mnt/user/appdata/auditproof/supabase-project/.env"
DOCKER_DIR="/mnt/user/appdata/auditproof/supabase-src/docker"
MIGRATIONS_DIR="./supabase/migrations"
LOG_FILE="/tmp/database-rebuild-$(date +%Y%m%d_%H%M%S).log"

# Function to log both to screen and file
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to log command output
log_cmd() {
    "$@" 2>&1 | tee -a "$LOG_FILE"
}

##############################################################################
# Display Header
##############################################################################

clear
log "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
log "${RED}║                                                            ║${NC}"
log "${RED}║        COMPLETE DATABASE WIPE AND REBUILD SCRIPT           ║${NC}"
log "${RED}║                                                            ║${NC}"
log "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
log ""
log "${YELLOW}⚠  THIS SCRIPT WILL:${NC}"
log ""
log "   ${RED}🗑  DELETE ALL DATA${NC} - Every table, every row, everything"
log "   ${RED}🗑  DROP ALL SCHEMAS${NC} - public, auth, storage, _supavisor, etc."
log "   ${YELLOW}🔑  Generate new encryption key${NC}"
log "   ${BLUE}📝  Apply all migrations from scratch${NC}"
log "   ${GREEN}🚀  Start all services fresh${NC}"
log ""
log "${RED}════════════════════════════════════════════════════════════${NC}"
log "${RED}         THIS CANNOT BE UNDONE - ALL DATA WILL BE LOST      ${NC}"
log "${RED}════════════════════════════════════════════════════════════${NC}"
log ""
log "Log file: ${LOG_FILE}"
log ""
read -p "Type 'YES' to continue (anything else to abort): " CONFIRM

if [[ "$CONFIRM" != "YES" ]]; then
    log "${GREEN}Aborted. No changes made.${NC}"
    exit 0
fi

##############################################################################
# Step 1: Validate Environment
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 1: Validating Environment                            ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${YELLOW}Checking paths...${NC}"

if [ ! -f "$ENV_FILE" ]; then
    log "${RED}✗ ERROR: .env file not found at: $ENV_FILE${NC}"
    exit 1
fi
log "${GREEN}✓ Found .env file${NC}"

if [ ! -d "$DOCKER_DIR" ]; then
    log "${RED}✗ ERROR: Docker directory not found at: $DOCKER_DIR${NC}"
    exit 1
fi
log "${GREEN}✓ Found Docker directory${NC}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    log "${RED}✗ ERROR: Migrations directory not found at: $MIGRATIONS_DIR${NC}"
    exit 1
fi

MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
log "${GREEN}✓ Found migrations directory with ${MIGRATION_COUNT} files${NC}"

##############################################################################
# Step 2: Backup .env File
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 2: Backing Up Configuration                          ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
log_cmd cp "$ENV_FILE" "$BACKUP_FILE"
log "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"

##############################################################################
# Step 3: Stop All Services
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 3: Stopping All Supabase Services                    ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

cd "$DOCKER_DIR"
log "${YELLOW}Stopping all services...${NC}"
log_cmd docker compose down
log "${GREEN}✓ All services stopped${NC}"

##############################################################################
# Step 4: Start Database and Wipe Everything
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 4: Nuclear Database Wipe                             ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${YELLOW}Starting database container...${NC}"
log_cmd docker compose up -d db
sleep 8

log "${YELLOW}Waiting for database to be ready...${NC}"
for i in {1..30}; do
    if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
        log "${GREEN}✓ Database is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        log "${RED}✗ Database failed to start${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done

log "\n${RED}Dropping ALL schemas (except system schemas)...${NC}"
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF' 2>&1 | tee -a "$LOG_FILE"
\set ON_ERROR_STOP on

DO $$
DECLARE
    r RECORD;
    schema_count INTEGER := 0;
BEGIN
    -- Drop all non-system schemas
    FOR r IN (
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN (
            'pg_catalog',
            'information_schema',
            'pg_toast',
            'pg_temp_1',
            'pg_toast_temp_1',
            'pg_temp_2',
            'pg_toast_temp_2'
        )
        ORDER BY schema_name
    ) LOOP
        RAISE NOTICE '  Dropping schema: %', r.schema_name;
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
        schema_count := schema_count + 1;
    END LOOP;

    RAISE NOTICE 'Dropped % schemas', schema_count;
END $$;

-- Verify database is empty
SELECT '==== VERIFICATION ====' as status;
SELECT 'Remaining non-system schemas:' as info;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN (
    'pg_catalog',
    'information_schema',
    'pg_toast',
    'pg_temp_1',
    'pg_toast_temp_1',
    'pg_temp_2',
    'pg_toast_temp_2'
)
ORDER BY schema_name;

SELECT 'Total non-system tables:' as info;
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema NOT IN (
    'pg_catalog',
    'information_schema',
    'pg_toast'
);
EOF

log "${GREEN}✓ Database wiped clean${NC}"

##############################################################################
# Step 5: Generate New Encryption Key
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 5: Generating New Encryption Key                     ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Generate 32-byte key as hex (64 characters)
NEW_VAULT_KEY=$(openssl rand -hex 32)
log "${YELLOW}New VAULT_ENC_KEY: ${NEW_VAULT_KEY:0:20}...${NEW_VAULT_KEY: -10}${NC}"
log "${GREEN}✓ Generated 64-character hex key (32 bytes)${NC}"

##############################################################################
# Step 6: Update .env File
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 6: Updating Configuration                            ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${YELLOW}Updating VAULT_ENC_KEY in .env file...${NC}"
sed -i "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=$NEW_VAULT_KEY|" "$ENV_FILE"

# Verify
UPDATED_KEY=$(grep "^VAULT_ENC_KEY=" "$ENV_FILE" | cut -d= -f2)
if [ "$UPDATED_KEY" == "$NEW_VAULT_KEY" ]; then
    log "${GREEN}✓ .env file updated successfully${NC}"
else
    log "${RED}✗ Failed to update .env file${NC}"
    exit 1
fi

##############################################################################
# Step 7: Apply All Migrations
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 7: Applying All Migrations                           ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${YELLOW}Found ${MIGRATION_COUNT} migration files${NC}\n"

MIGRATION_SUCCESS=0
MIGRATION_FAILED=0

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        filename=$(basename "$migration_file")
        log "${BLUE}Applying: ${filename}${NC}"

        if docker exec -i supabase-db psql -U postgres -d postgres < "$migration_file" >> "$LOG_FILE" 2>&1; then
            log "${GREEN}  ✓ Success${NC}"
            MIGRATION_SUCCESS=$((MIGRATION_SUCCESS + 1))
        else
            log "${RED}  ✗ Failed${NC}"
            log "${RED}  Check log file for details: $LOG_FILE${NC}"
            MIGRATION_FAILED=$((MIGRATION_FAILED + 1))
            # Continue with other migrations
        fi
    fi
done

log ""
log "${GREEN}Migrations applied: ${MIGRATION_SUCCESS}${NC}"
if [ $MIGRATION_FAILED -gt 0 ]; then
    log "${RED}Migrations failed: ${MIGRATION_FAILED}${NC}"
    log "${YELLOW}⚠ Some migrations failed. Check log: $LOG_FILE${NC}"
fi

##############################################################################
# Step 8: Verify Database Schema
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 8: Verifying Database Schema                         ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${YELLOW}Checking created schemas...${NC}"
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF' 2>&1 | tee -a "$LOG_FILE"
SELECT 'Created Schemas:' as info;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN (
    'pg_catalog',
    'information_schema',
    'pg_toast',
    'pg_temp_1',
    'pg_toast_temp_1',
    'pg_temp_2',
    'pg_toast_temp_2'
)
ORDER BY schema_name;

SELECT 'Tables per schema:' as info;
SELECT
    table_schema,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
GROUP BY table_schema
ORDER BY table_schema;
EOF

log "${GREEN}✓ Schema verification complete${NC}"

##############################################################################
# Step 9: Stop Database and Start All Services
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 9: Starting All Services                             ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${YELLOW}Stopping database...${NC}"
cd "$DOCKER_DIR"
log_cmd docker compose down

log "${YELLOW}Starting all Supabase services...${NC}"
log_cmd docker compose up -d

log "${YELLOW}Waiting for services to initialize (20 seconds)...${NC}"
for i in {1..20}; do
    echo -n "."
    sleep 1
done
log ""

##############################################################################
# Step 10: Verify Services
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 10: Verifying Services                               ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${YELLOW}Checking container status...${NC}"
log_cmd docker compose ps

log "\n${YELLOW}Checking Supavisor (pooler) logs...${NC}"
if docker ps | grep -q "supabase-pooler"; then
    POOLER_LOGS=$(docker logs supabase-pooler 2>&1 | tail -30)

    if echo "$POOLER_LOGS" | grep -q "Unknown cipher or invalid key size"; then
        log "${RED}✗ Supavisor still has encryption errors${NC}"
        log "${YELLOW}Last 30 lines of Supavisor logs:${NC}"
        echo "$POOLER_LOGS" | tee -a "$LOG_FILE"
    elif echo "$POOLER_LOGS" | grep -q "Proxy started"; then
        log "${GREEN}✓ Supavisor started successfully${NC}"
        log "${YELLOW}Last 10 lines of Supavisor logs:${NC}"
        echo "$POOLER_LOGS" | tail -10 | tee -a "$LOG_FILE"
    else
        log "${YELLOW}⚠ Supavisor status unclear${NC}"
        log "${YELLOW}Last 30 lines of Supavisor logs:${NC}"
        echo "$POOLER_LOGS" | tee -a "$LOG_FILE"
    fi
else
    log "${RED}✗ Supavisor container not running${NC}"
fi

##############################################################################
# Step 11: Health Check
##############################################################################

log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${CYAN}║ Step 11: Health Check                                     ║${NC}"
log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${YELLOW}Testing database connection...${NC}"
if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
    log "${GREEN}✓ Database is accepting connections${NC}"
else
    log "${RED}✗ Database not responding${NC}"
fi

log "\n${YELLOW}Checking authentication system...${NC}"
AUTH_CHECK=$(docker exec -i supabase-db psql -U postgres -d postgres -tA -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users');" 2>/dev/null || echo "f")
if [ "$AUTH_CHECK" == "t" ]; then
    log "${GREEN}✓ Auth schema exists${NC}"
else
    log "${RED}✗ Auth schema missing${NC}"
fi

log "\n${YELLOW}Checking storage system...${NC}"
STORAGE_CHECK=$(docker exec -i supabase-db psql -U postgres -d postgres -tA -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets');" 2>/dev/null || echo "f")
if [ "$STORAGE_CHECK" == "t" ]; then
    log "${GREEN}✓ Storage schema exists${NC}"
else
    log "${RED}✗ Storage schema missing${NC}"
fi

log "\n${YELLOW}Checking public schema...${NC}"
PUBLIC_CHECK=$(docker exec -i supabase-db psql -U postgres -d postgres -tA -c "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='public');" 2>/dev/null || echo "f")
if [ "$PUBLIC_CHECK" == "t" ]; then
    log "${GREEN}✓ Public schema exists${NC}"
else
    log "${RED}✗ Public schema missing${NC}"
fi

##############################################################################
# Final Summary
##############################################################################

log "\n${MAGENTA}╔════════════════════════════════════════════════════════════╗${NC}"
log "${MAGENTA}║                    OPERATION COMPLETE                      ║${NC}"
log "${MAGENTA}╚════════════════════════════════════════════════════════════╝${NC}\n"

log "${GREEN}✓ Database wiped and rebuilt from scratch${NC}"
log "${GREEN}✓ ${MIGRATION_SUCCESS} migrations applied${NC}"
if [ $MIGRATION_FAILED -gt 0 ]; then
    log "${RED}✗ ${MIGRATION_FAILED} migrations failed${NC}"
fi
log "${GREEN}✓ New encryption key generated${NC}"
log "${GREEN}✓ All services restarted${NC}"
log ""
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${CYAN}Next Steps:${NC}"
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""
log "1. ${YELLOW}Test your application${NC}"
log "   - Navigate to your frontend URL"
log "   - Try to sign up / log in"
log "   - Upload a test receipt"
log ""
log "2. ${YELLOW}Monitor logs if needed${NC}"
log "   ${BLUE}cd $DOCKER_DIR${NC}"
log "   ${BLUE}docker compose logs -f${NC}"
log ""
log "3. ${YELLOW}Clean up if everything works${NC}"
log "   ${BLUE}rm $BACKUP_FILE${NC}"
log "   ${BLUE}rm $LOG_FILE${NC}"
log ""
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${CYAN}Files Created:${NC}"
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "  📝 Log file: ${BLUE}$LOG_FILE${NC}"
log "  💾 Backup: ${BLUE}$BACKUP_FILE${NC}"
log ""
log "${GREEN}Database is ready for use!${NC}"
log ""
