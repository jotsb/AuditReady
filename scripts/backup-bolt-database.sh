#!/bin/bash
# =====================================================
# BACKUP BOLT DATABASE (Supabase Cloud)
# =====================================================
# This script backs up your Bolt.new Supabase database
# to a local SQL file for restore on Unraid
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timestamp for backup file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/bolt_database_backup_${TIMESTAMP}.sql"
DATA_BACKUP_FILE="${BACKUP_DIR}/bolt_database_data_${TIMESTAMP}.sql"

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  BOLT DATABASE BACKUP UTILITY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} Created backup directory: ${BACKUP_DIR}"

# Extract database connection info from Bolt Supabase
BOLT_PROJECT_ID="mnmfwqfbksughmthfutg"
BOLT_DB_HOST="${BOLT_PROJECT_ID}.supabase.co"

echo ""
echo -e "${YELLOW}IMPORTANT: You need the database password from Bolt/Supabase${NC}"
echo -e "${YELLOW}Get it from: https://supabase.com/dashboard/project/${BOLT_PROJECT_ID}/settings/database${NC}"
echo ""
echo -n "Enter Bolt database password: "
read -s BOLT_DB_PASSWORD
echo ""
echo ""

# Test connection
echo -e "${BLUE}Testing connection to Bolt database...${NC}"
if ! PGPASSWORD="$BOLT_DB_PASSWORD" psql -h "$BOLT_DB_HOST" -U postgres -d postgres -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to connect to Bolt database${NC}"
    echo -e "${RED}  Please check your password and ensure you can connect${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Connected successfully!"
echo ""

# Backup schema only (structure)
echo -e "${BLUE}Backing up database schema...${NC}"
PGPASSWORD="$BOLT_DB_PASSWORD" pg_dump \
    -h "$BOLT_DB_HOST" \
    -U postgres \
    -d postgres \
    --schema-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    --schema=storage \
    --exclude-schema=auth \
    --exclude-schema=extensions \
    --exclude-schema=graphql \
    --exclude-schema=graphql_public \
    --exclude-schema=pgbouncer \
    --exclude-schema=pgsodium \
    --exclude-schema=pgsodium_masks \
    --exclude-schema=realtime \
    --exclude-schema=supabase_functions \
    --exclude-schema=vault \
    -f "$BACKUP_FILE"

echo -e "${GREEN}✓${NC} Schema backed up to: ${BACKUP_FILE}"
echo ""

# Backup data
echo -e "${BLUE}Backing up database data...${NC}"
PGPASSWORD="$BOLT_DB_PASSWORD" pg_dump \
    -h "$BOLT_DB_HOST" \
    -U postgres \
    -d postgres \
    --data-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    --schema=storage \
    --exclude-table='auth.*' \
    --exclude-table='storage.objects' \
    --exclude-table='storage.buckets' \
    -f "$DATA_BACKUP_FILE"

echo -e "${GREEN}✓${NC} Data backed up to: ${DATA_BACKUP_FILE}"
echo ""

# Get file sizes
SCHEMA_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
DATA_SIZE=$(du -h "$DATA_BACKUP_FILE" | cut -f1)

# Summary
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  BACKUP COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "Schema backup: ${BACKUP_FILE} (${SCHEMA_SIZE})"
echo -e "Data backup:   ${DATA_BACKUP_FILE} (${DATA_SIZE})"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Copy both files to your Unraid server"
echo -e "2. Run restore-to-unraid.sh on your Unraid server"
echo ""
echo -e "${BLUE}Backup completed at: $(date)${NC}"
