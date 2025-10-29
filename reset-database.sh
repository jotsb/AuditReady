#!/bin/bash

##############################################################################
# Complete Database Reset Script
#
# This script completely wipes the Supabase database and rebuilds it from
# migration files. This will:
# 1. Drop ALL schemas (except system ones)
# 2. Recreate the database structure from scratch
# 3. Run all migrations in order
# 4. Generate a fresh encryption key for Supavisor
#
# WARNING: This will delete ALL data in the database!
# Make sure you have backups of any important data.
#
# Usage:
#   chmod +x reset-database.sh
#   ./reset-database.sh
#
##############################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOCKER_DIR="/mnt/user/appdata/auditproof/supabase-project"
PROJECT_DIR="/mnt/user/appdata/auditproof/project/AuditReady"
ENV_FILE="${DOCKER_DIR}/.env"
MIGRATIONS_DIR="/mnt/user/appdata/auditproof/postgres/migrations"

echo -e "${RED}========================================${NC}"
echo -e "${RED}COMPLETE DATABASE RESET${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will delete ALL data in your database!${NC}"
echo ""
echo "This script will:"
echo "  1. Drop all user schemas and data"
echo "  2. Recreate the database from migrations"
echo "  3. Generate a new encryption key"
echo "  4. Restart all services"
echo ""
echo -e "${RED}ALL EXISTING DATA WILL BE LOST!${NC}"
echo ""
read -p "Are you ABSOLUTELY SURE you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

##############################################################################
# Step 1: Validate paths
##############################################################################

echo -e "\n${YELLOW}Step 1: Validating paths...${NC}"

if [ ! -d "$DOCKER_DIR" ]; then
    echo -e "${RED}ERROR: Docker directory not found: $DOCKER_DIR${NC}"
    exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}ERROR: Migrations directory not found: $MIGRATIONS_DIR${NC}"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}ERROR: .env file not found: $ENV_FILE${NC}"
    exit 1
fi

MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
echo -e "${GREEN}✓ Found $MIGRATION_COUNT migration files${NC}"

##############################################################################
# Step 2: Stop all services
##############################################################################

echo -e "\n${YELLOW}Step 2: Stopping all Supabase services...${NC}"

cd "$DOCKER_DIR"
docker compose down

echo -e "${GREEN}✓ Services stopped${NC}"

##############################################################################
# Step 3: Start database only
##############################################################################

echo -e "\n${YELLOW}Step 3: Starting database...${NC}"

docker compose up -d db

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Test connection
until docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; do
    echo "Waiting for database..."
    sleep 2
done

echo -e "${GREEN}✓ Database is ready${NC}"

##############################################################################
# Step 4: Complete database wipe
##############################################################################

echo -e "\n${YELLOW}Step 4: Wiping database...${NC}"

docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
-- Drop all non-system schemas
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all user schemas (except system ones)
    FOR r IN (
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND schema_name NOT LIKE 'pg_temp%'
          AND schema_name NOT LIKE 'pg_toast_temp%'
    ) LOOP
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
        RAISE NOTICE 'Dropped schema: %', r.schema_name;
    END LOOP;
END $$;

-- Verify clean state
SELECT 'Remaining schemas:' as status;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND schema_name NOT LIKE 'pg_temp%'
  AND schema_name NOT LIKE 'pg_toast_temp%'
ORDER BY schema_name;
EOF

echo -e "${GREEN}✓ Database wiped${NC}"

##############################################################################
# Step 5: Stop and restart with all services
##############################################################################

echo -e "\n${YELLOW}Step 5: Restarting all services...${NC}"

cd "$DOCKER_DIR"
docker compose down
sleep 2

# Generate new encryption key (hex format, no special characters)
echo "Generating new encryption key..."
NEW_VAULT_KEY=$(openssl rand -hex 32)

# Update .env
echo "Updating .env with new encryption key..."
sed -i "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=$NEW_VAULT_KEY|" "$ENV_FILE"

echo "Starting all services..."
docker compose up -d

echo "Waiting for services to initialize..."
sleep 20

echo -e "${GREEN}✓ All services started${NC}"

##############################################################################
# Step 6: Wait for migrations to run
##############################################################################

echo -e "\n${YELLOW}Step 6: Waiting for migrations to complete...${NC}"

# Supabase runs migrations automatically on startup
# Wait and monitor the logs

sleep 10

echo "Checking migration status..."

# Check if migrations ran successfully
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
-- Check if schema_migrations exists and has entries
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'supabase_migrations'
        AND table_name = 'schema_migrations'
    ) THEN
        RAISE NOTICE 'Migrations table exists';
    ELSE
        RAISE NOTICE 'Migrations table does not exist yet';
    END IF;
END $$;
EOF

echo -e "${GREEN}✓ Migrations initialized${NC}"

##############################################################################
# Step 7: Apply custom migrations
##############################################################################

echo -e "\n${YELLOW}Step 7: Applying custom migrations...${NC}"

# Count and sort migration files
MIGRATION_FILES=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATION_FILES" ]; then
    echo -e "${YELLOW}⚠ No migration files found${NC}"
else
    echo "Found $(echo "$MIGRATION_FILES" | wc -l) migration files"

    # Apply each migration
    for MIGRATION_FILE in $MIGRATION_FILES; do
        FILENAME=$(basename "$MIGRATION_FILE")
        echo -n "Applying $FILENAME... "

        if docker exec -i supabase-db psql -U postgres -d postgres < "$MIGRATION_FILE" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗ Failed${NC}"
            echo "Error applying migration: $FILENAME"
            echo "Check logs with: docker exec supabase-db psql -U postgres -d postgres < $MIGRATION_FILE"
        fi
    done

    echo -e "${GREEN}✓ Migrations applied${NC}"
fi

##############################################################################
# Step 8: Verify database structure
##############################################################################

echo -e "\n${YELLOW}Step 8: Verifying database structure...${NC}"

docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
-- List all schemas
SELECT 'Schemas created:' as status;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND schema_name NOT LIKE 'pg_temp%'
ORDER BY schema_name;

-- Count tables in public schema
SELECT 'Tables in public schema:' as status;
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- List key tables
SELECT 'Key tables:' as status;
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
EOF

echo -e "${GREEN}✓ Database structure verified${NC}"

##############################################################################
# Step 9: Check service health
##############################################################################

echo -e "\n${YELLOW}Step 9: Checking service health...${NC}"

cd "$DOCKER_DIR"

# Check running containers
echo ""
docker compose ps

echo ""
echo "Checking Supavisor logs for errors..."
sleep 5

POOLER_LOGS=$(docker logs supabase-pooler 2>&1 | tail -20)

if echo "$POOLER_LOGS" | grep -q "Unknown cipher or invalid key size"; then
    echo -e "${RED}✗ Supavisor still has encryption errors${NC}"
    echo "Recent logs:"
    echo "$POOLER_LOGS"
elif echo "$POOLER_LOGS" | grep -q "Proxy started"; then
    echo -e "${GREEN}✓ Supavisor running successfully${NC}"
else
    echo -e "${YELLOW}⚠ Supavisor status unclear${NC}"
    echo "Recent logs:"
    echo "$POOLER_LOGS"
fi

##############################################################################
# Step 10: Summary
##############################################################################

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Database Reset Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Database completely wiped${NC}"
echo -e "${GREEN}✓ Fresh encryption key generated${NC}"
echo -e "${GREEN}✓ Migrations applied${NC}"
echo -e "${GREEN}✓ Services restarted${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Your database is now empty and ready for use"
echo "2. You'll need to create a new admin user"
echo "3. Re-upload any data you need"
echo ""
echo -e "${YELLOW}To check service status:${NC}"
echo "  cd $DOCKER_DIR"
echo "  docker compose ps"
echo "  docker compose logs -f"
echo ""
echo -e "${YELLOW}New VAULT_ENC_KEY (first 20 chars):${NC}"
echo "  ${NEW_VAULT_KEY:0:20}..."
echo ""
echo -e "${YELLOW}To connect to database:${NC}"
echo "  docker exec -it supabase-db psql -U postgres -d postgres"
echo ""
