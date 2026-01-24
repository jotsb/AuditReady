#!/bin/bash

# Pre-flight check before running migrations
# Verifies environment is ready for migrations

set -e

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-supabase-db}"

echo "=== Pre-Flight Migration Check ==="
echo ""

# Check 1: Docker is available
echo "1. Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "   ✗ FAIL: docker command not found"
    exit 1
fi
echo "   ✓ PASS: Docker installed"

# Check 2: Container is running
echo "2. Checking Supabase container..."
if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
    echo "   ✗ FAIL: Container '$POSTGRES_CONTAINER' is not running"
    echo "   Start it with: docker-compose up -d"
    exit 1
fi
echo "   ✓ PASS: Container is running"

# Check 3: PostgreSQL is responding
echo "3. Checking PostgreSQL connection..."
if ! docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✗ FAIL: Cannot connect to PostgreSQL"
    echo "   Check container logs: docker logs $POSTGRES_CONTAINER"
    exit 1
fi
echo "   ✓ PASS: PostgreSQL is responding"

# Check 4: Required extensions
echo "4. Checking required PostgreSQL extensions..."
extensions=("uuid-ossp" "pg_net" "pg_trgm")
for ext in "${extensions[@]}"; do
    if ! docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -t -c \
        "SELECT 1 FROM pg_extension WHERE extname = '$ext';" | grep -q 1; then
        echo "   ⚠ WARNING: Extension '$ext' not installed"
        echo "   It will be installed by prerequisite migration"
    else
        echo "   ✓ $ext installed"
    fi
done

# Check 5: Migration files exist
echo "5. Checking migration files..."
if [ ! -d "supabase/migrations" ]; then
    echo "   ✗ FAIL: Migration directory not found"
    exit 1
fi

migration_count=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l)
if [ "$migration_count" -eq 0 ]; then
    echo "   ✗ FAIL: No migration files found"
    exit 1
fi
echo "   ✓ PASS: Found $migration_count migration files"

# Check 6: Prerequisite migration exists
echo "6. Checking prerequisite migration..."
if [ ! -f "supabase/migrations/00000000000000_initial_setup_prerequisites.sql" ]; then
    echo "   ✗ FAIL: Prerequisite migration not found"
    exit 1
fi
echo "   ✓ PASS: Prerequisite migration exists"

# Check 7: Migration tracking
echo "7. Checking migration tracking..."
tracking_exists=$(docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -t -c \
    "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations');" | tr -d ' ')

if [ "$tracking_exists" = "t" ]; then
    applied_count=$(docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d postgres -t -c \
        "SELECT COUNT(*) FROM public.schema_migrations;" | tr -d ' ')
    echo "   ✓ Tracking table exists ($applied_count migrations already applied)"
else
    echo "   ℹ Tracking table will be created"
fi

# Check 8: Backup recommendation
echo "8. Checking for recent backup..."
echo "   ⚠ RECOMMENDATION: Back up your database before running migrations"
echo "   Create backup with:"
echo "     docker exec -i $POSTGRES_CONTAINER pg_dump -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql"
echo ""

# Check 9: Disk space
echo "9. Checking disk space..."
available_mb=$(df -m . | tail -1 | awk '{print $4}')
if [ "$available_mb" -lt 1000 ]; then
    echo "   ⚠ WARNING: Less than 1GB free disk space ($available_mb MB)"
else
    echo "   ✓ PASS: Sufficient disk space ($available_mb MB available)"
fi

echo ""
echo "=== Pre-Flight Check Complete ==="
echo ""
echo "Status: ✓ Environment is ready for migrations"
echo ""
echo "Next steps:"
echo "  1. Create backup (recommended)"
echo "  2. Run: ./run-migrations.sh"
echo "  3. Monitor for errors"
echo "  4. Verify with: ./verify-migrations.sh (if available)"
echo ""
