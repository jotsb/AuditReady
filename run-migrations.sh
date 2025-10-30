#!/bin/bash

# Migration runner script with idempotent execution
# This script runs all migrations in correct order and tracks which ones completed

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIGRATIONS_DIR="./supabase/migrations"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-supabase-db}"
STATE_TABLE="schema_migrations"

echo -e "${BLUE}=== AuditProof Migration Runner ===${NC}"
echo ""

# Check if docker container is running
if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
    echo -e "${RED}ERROR: PostgreSQL container '$POSTGRES_CONTAINER' is not running${NC}"
    exit 1
fi

# Create migration tracking table if it doesn't exist
echo -e "${YELLOW}Setting up migration tracking...${NC}"
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres <<'EOF'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT TRUE
);
EOF

echo -e "${GREEN}✓ Migration tracking ready${NC}"
echo ""

# Function to check if migration was already applied
is_migration_applied() {
    local migration_name=$1
    docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -t -c \
        "SELECT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version = '$migration_name' AND success = TRUE);" \
        | grep -q 't'
}

# Function to record successful migration
record_migration() {
    local migration_name=$1
    docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c \
        "INSERT INTO public.schema_migrations (version, success) VALUES ('$migration_name', TRUE) ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), success = TRUE;"
}

# Get all migration files in sorted order
cd "$MIGRATIONS_DIR" || exit 1
migration_files=($(ls -1 *.sql 2>/dev/null | sort))

if [ ${#migration_files[@]} -eq 0 ]; then
    echo -e "${RED}ERROR: No migration files found in $MIGRATIONS_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}Found ${#migration_files[@]} migration files${NC}"
echo ""

# Run migrations in order
success_count=0
skip_count=0
error_count=0

for file in "${migration_files[@]}"; do
    migration_name="${file%.sql}"

    if is_migration_applied "$migration_name"; then
        echo -e "${YELLOW}⊘ SKIP:${NC} $file (already applied)"
        ((skip_count++))
        continue
    fi

    echo -e "${BLUE}→ RUN:${NC}  $file"

    if docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres < "$file" 2>&1 | grep -v "^$"; then
        record_migration "$migration_name"
        echo -e "${GREEN}✓ DONE:${NC} $file"
        ((success_count++))
    else
        echo -e "${RED}✗ FAIL:${NC} $file"
        ((error_count++))
        echo -e "${RED}Migration failed. Stopping.${NC}"
        exit 1
    fi

    echo ""
done

# Summary
echo -e "${BLUE}=== Migration Summary ===${NC}"
echo -e "${GREEN}✓ Applied:${NC}  $success_count"
echo -e "${YELLOW}⊘ Skipped:${NC} $skip_count (already applied)"
echo -e "${RED}✗ Failed:${NC}  $error_count"
echo ""

if [ $error_count -eq 0 ]; then
    echo -e "${GREEN}All migrations completed successfully!${NC}"
    exit 0
else
    echo -e "${RED}Some migrations failed. Please check the errors above.${NC}"
    exit 1
fi
