#!/bin/bash

# Migration runner script with idempotent execution
# This script runs all migrations in correct order and tracks which ones completed

set +e  # Don't exit on error - we handle errors manually

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
MIGRATIONS_DIR="./supabase/migrations"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-supabase-db}"
STATE_TABLE="schema_migrations"

# Parse command line arguments
RESET_TRACKING=false
if [ "$1" == "--reset" ]; then
    RESET_TRACKING=true
fi

echo -e "${BLUE}=== AuditProof Migration Runner ===${NC}"
echo ""

# Check if docker container is running
if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
    echo -e "${RED}ERROR: PostgreSQL container '$POSTGRES_CONTAINER' is not running${NC}"
    exit 1
fi

# Create migration tracking table if it doesn't exist
echo -e "${YELLOW}Setting up migration tracking...${NC}"
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres <<'EOF' 2>&1 | grep -v "already exists, skipping"
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT TRUE
);
EOF

# Reset tracking if requested
if [ "$RESET_TRACKING" = true ]; then
    echo -e "${YELLOW}Resetting migration tracking...${NC}"
    docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c "TRUNCATE TABLE public.schema_migrations;"
    echo -e "${GREEN}✓ Tracking table reset${NC}"
fi

# Show current tracking status
tracked_count=$(docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM public.schema_migrations;" | tr -d ' ')
echo -e "${CYAN}✓ Migration tracking ready (${tracked_count} migrations already applied)${NC}"
echo ""

# Get all migration files in sorted order
cd "$MIGRATIONS_DIR" || exit 1
mapfile -t migration_files < <(ls -1 *.sql 2>/dev/null | sort -V)

if [ ${#migration_files[@]} -eq 0 ]; then
    echo -e "${RED}ERROR: No migration files found in $MIGRATIONS_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}Found ${#migration_files[@]} migration files${NC}"
echo ""

# Function to check if migration was already applied
is_migration_applied() {
    local migration_name=$1
    result=$(docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -t -c \
        "SELECT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version = '$migration_name' AND success = TRUE);" 2>/dev/null)
    echo "$result" | grep -q 't'
}

# Function to record successful migration
record_migration() {
    local migration_name=$1
    docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c \
        "INSERT INTO public.schema_migrations (version, success) VALUES ('$migration_name', TRUE) ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), success = TRUE;" >/dev/null 2>&1
}

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

    # Run migration and capture output
    output=$(docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres < "$file" 2>&1)

    # Show output, filtering empty lines and known non-critical warnings
    filtered_output=$(echo "$output" | grep -v "^$" | \
        grep -v "NOTICE:.*already exists, skipping" | \
        grep -v "NOTICE:.*does not exist, skipping")

    if [ -n "$filtered_output" ]; then
        echo "$filtered_output" | head -20  # Limit output to 20 lines
        line_count=$(echo "$filtered_output" | wc -l)
        if [ "$line_count" -gt 20 ]; then
            echo -e "${CYAN}... (${line_count} total lines, showing first 20)${NC}"
        fi
    fi

    # Check for critical errors (exclude known storage policy issues on self-hosted)
    critical_errors=$(echo "$output" | grep "ERROR" | \
        grep -v "policy.*already exists" | \
        grep -v "must be owner of table objects" | \
        grep -v "does not exist, skipping")

    if [ -n "$critical_errors" ]; then
        echo -e "${RED}✗ FAIL:${NC} $file"
        echo -e "${RED}Critical errors:${NC}"
        echo "$critical_errors"
        ((error_count++))
        echo ""
        echo -e "${RED}Migration failed. Stopping.${NC}"
        echo -e "${YELLOW}To see what succeeded: docker exec -i $POSTGRES_CONTAINER psql -U postgres -d postgres -c 'SELECT * FROM schema_migrations ORDER BY applied_at;'${NC}"
        exit 1
    else
        record_migration "$migration_name"
        echo -e "${GREEN}✓ DONE:${NC} $file"
        ((success_count++))
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
    if [ $success_count -eq 0 ] && [ $skip_count -gt 0 ]; then
        echo -e "${CYAN}Note: All migrations were already applied. To re-run, use: ./run-migrations.sh --reset${NC}"
    fi
    exit 0
else
    echo -e "${RED}Some migrations failed. Please check the errors above.${NC}"
    exit 1
fi
