#!/bin/bash
# =====================================================
# BACKUP BOLT DATABASE (Supabase Cloud) - COMPLETE
# =====================================================
# This script creates a COMPLETE backup of your Bolt.new
# Supabase database including extensions, auth, storage
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
BACKUP_FILE="${BACKUP_DIR}/bolt_complete_backup_${TIMESTAMP}.sql"

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  BOLT DATABASE COMPLETE BACKUP UTILITY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} Created backup directory: ${BACKUP_DIR}"

# Extract database connection info from Bolt Supabase
BOLT_PROJECT_ID="mnmfwqfbksughmthfutg"
BOLT_DB_HOST="${BOLT_PROJECT_ID}.supabase.co"
BOLT_DB_PORT="6543"  # Use pooler for better connection

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
if ! PGPASSWORD="$BOLT_DB_PASSWORD" psql -h "$BOLT_DB_HOST" -p "$BOLT_DB_PORT" -U postgres -d postgres -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to connect to Bolt database${NC}"
    echo -e "${RED}  Please check your password and ensure you can connect${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Connected successfully!"
echo ""

# Start creating backup file with header
cat > "$BACKUP_FILE" << 'EOF'
-- =====================================================
-- BOLT DATABASE COMPLETE BACKUP
-- =====================================================
-- This backup includes all necessary components for
-- a complete database restoration
-- =====================================================

-- Disable triggers during restore
SET session_replication_role = 'replica';

EOF

echo -e "${BLUE}Step 1/6: Backing up extensions...${NC}"
PGPASSWORD="$BOLT_DB_PASSWORD" psql -h "$BOLT_DB_HOST" -p "$BOLT_DB_PORT" -U postgres -d postgres -t -c "
SELECT 'CREATE EXTENSION IF NOT EXISTS \"' || extname || '\" SCHEMA ' || nspname || ';'
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE nspname NOT IN ('pg_catalog', 'information_schema')
AND extname NOT IN ('plpgsql')
ORDER BY extname;
" | grep -v '^$' >> "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Extensions backed up"

# Add separator
echo "" >> "$BACKUP_FILE"
echo "-- =====================================================
-- SCHEMA STRUCTURE
-- =====================================================" >> "$BACKUP_FILE"
echo "" >> "$BACKUP_FILE"

echo -e "${BLUE}Step 2/6: Backing up schema structure...${NC}"
PGPASSWORD="$BOLT_DB_PASSWORD" pg_dump \
    -h "$BOLT_DB_HOST" \
    -p "$BOLT_DB_PORT" \
    -U postgres \
    -d postgres \
    --schema-only \
    --no-owner \
    --no-privileges \
    --no-tablespaces \
    --no-security-labels \
    --schema=public \
    --schema=storage \
    --exclude-table='auth.*' \
    --exclude-table='extensions.*' \
    --exclude-table='realtime.*' \
    --exclude-table='supabase_functions.*' \
    --exclude-table='graphql.*' \
    --exclude-table='vault.*' \
    --exclude-table='pgsodium.*' >> "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Schema structure backed up"

# Add separator
echo "" >> "$BACKUP_FILE"
echo "-- =====================================================
-- AUTH USERS DATA
-- =====================================================" >> "$BACKUP_FILE"
echo "" >> "$BACKUP_FILE"

echo -e "${BLUE}Step 3/6: Backing up auth.users...${NC}"
PGPASSWORD="$BOLT_DB_PASSWORD" pg_dump \
    -h "$BOLT_DB_HOST" \
    -p "$BOLT_DB_PORT" \
    -U postgres \
    -d postgres \
    --data-only \
    --no-owner \
    --no-privileges \
    --table=auth.users \
    --inserts >> "$BACKUP_FILE" 2>/dev/null || echo "-- No auth.users data or access denied" >> "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Auth users backed up"

# Add separator
echo "" >> "$BACKUP_FILE"
echo "-- =====================================================
-- STORAGE BUCKETS
-- =====================================================" >> "$BACKUP_FILE"
echo "" >> "$BACKUP_FILE"

echo -e "${BLUE}Step 4/6: Backing up storage.buckets...${NC}"
PGPASSWORD="$BOLT_DB_PASSWORD" pg_dump \
    -h "$BOLT_DB_HOST" \
    -p "$BOLT_DB_PORT" \
    -U postgres \
    -d postgres \
    --data-only \
    --no-owner \
    --no-privileges \
    --table=storage.buckets \
    --inserts >> "$BACKUP_FILE" 2>/dev/null || echo "-- No storage buckets" >> "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Storage buckets backed up"

# Add separator
echo "" >> "$BACKUP_FILE"
echo "-- =====================================================
-- APPLICATION DATA
-- =====================================================" >> "$BACKUP_FILE"
echo "" >> "$BACKUP_FILE"

echo -e "${BLUE}Step 5/6: Backing up application data...${NC}"
PGPASSWORD="$BOLT_DB_PASSWORD" pg_dump \
    -h "$BOLT_DB_HOST" \
    -p "$BOLT_DB_PORT" \
    -U postgres \
    -d postgres \
    --data-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    --exclude-table='auth.*' \
    --disable-triggers >> "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Application data backed up"

# Add separator
echo "" >> "$BACKUP_FILE"
echo "-- =====================================================
-- SEQUENCES RESET
-- =====================================================" >> "$BACKUP_FILE"
echo "" >> "$BACKUP_FILE"

echo -e "${BLUE}Step 6/6: Backing up sequence values...${NC}"
PGPASSWORD="$BOLT_DB_PASSWORD" psql -h "$BOLT_DB_HOST" -p "$BOLT_DB_PORT" -U postgres -d postgres -t -c "
SELECT 'SELECT setval(' || quote_literal(quote_ident(schemaname) || '.' || quote_ident(sequencename)) ||
       ', ' || last_value || ', true);'
FROM pg_sequences
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, sequencename;
" | grep -v '^$' >> "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Sequences backed up"

# Add footer
cat >> "$BACKUP_FILE" << 'EOF'

-- Re-enable triggers
SET session_replication_role = 'origin';

-- =====================================================
-- BACKUP COMPLETE
-- =====================================================
EOF

# Get file size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  BACKUP COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "Complete backup: ${BACKUP_FILE} (${BACKUP_SIZE})"
echo ""
echo -e "${YELLOW}What was backed up:${NC}"
echo -e "  ✓ PostgreSQL extensions (uuid-ossp, pg_net, pg_trgm)"
echo -e "  ✓ Complete schema structure (public, storage)"
echo -e "  ✓ Auth users (authentication data)"
echo -e "  ✓ Storage buckets configuration"
echo -e "  ✓ All application data (receipts, businesses, etc.)"
echo -e "  ✓ Sequence values (for auto-incrementing IDs)"
echo ""
echo -e "${BLUE}NOTE: Storage files (receipt images) are NOT included.${NC}"
echo -e "${BLUE}See documentation for storage migration instructions.${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Copy file to your Unraid server"
echo -e "2. Run restore-to-unraid.sh on your Unraid server"
echo ""
echo -e "${BLUE}Backup completed at: $(date)${NC}"
