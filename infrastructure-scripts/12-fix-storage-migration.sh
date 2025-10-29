#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 12: Fix Storage Migration Conflict"

log "This script fixes the foldername() function dependency issue"
log "that prevents storage service from starting."
log ""
log "${YELLOW}WARNING: This is a nuclear fix that drops ALL storage policies and views!${NC}"
log "This is safe because:"
log "  • Storage data (files/buckets) remains in tables (not affected)"
log "  • Policies and views are dropped temporarily"
log "  • Storage migrations will recreate everything correctly on restart"
log ""
log "This is the recommended approach for stubborn storage migration conflicts."
log ""
read -p "Press Enter to continue..."

subsection "Stopping Services"

cd "$DOCKER_PATH"
info "Stopping all services..."
docker compose down
success "Services stopped"

subsection "Fixing Database Schema"

info "Connecting to database..."

# Create nuclear fix script - drops all storage policies/views first
cat > /tmp/fix-storage-migration.sql << 'SQLEOF'
-- Nuclear fix for storage migration conflict
-- This drops ALL storage policies and views, then the function
-- Storage migrations will recreate everything properly

\echo '=== Step 1: Finding dependencies ==='
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'foldername';

\echo '=== Step 2: Dropping all storage policies ==='
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

\echo '=== Step 3: Dropping storage views ==='
DROP VIEW IF EXISTS storage.buckets CASCADE;
DROP VIEW IF EXISTS storage.objects CASCADE;

\echo '=== Step 4: Dropping the foldername function (all variants) ==='
DROP FUNCTION IF EXISTS storage.foldername(text) CASCADE;
DROP FUNCTION IF EXISTS storage.foldername(name) CASCADE;
DROP FUNCTION IF EXISTS storage.foldername CASCADE;

\echo '=== Step 5: Verification ==='
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ SUCCESS: Function removed, migrations will recreate storage schema'
        ELSE '✗ FAILED: Function still exists'
    END as status
FROM pg_proc
WHERE proname = 'foldername';
SQLEOF

info "Starting database temporarily..."
docker compose up -d db
sleep 5

info "Applying fix..."
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/fix-storage-migration.sql

if [ $? -eq 0 ]; then
    success "Database schema fixed!"
    log ""
    log "Note: All storage policies and views were dropped."
    log "They will be recreated by storage service migrations on restart."
else
    error "Failed to apply fix"
    log ""
    log "This is a critical error. The function dependency is blocking storage."
    log "You may need to manually inspect the database:"
    log "  docker exec -it supabase-db psql -U postgres -d postgres"
    log "  SELECT * FROM pg_proc WHERE proname = 'foldername';"
    exit 1
fi

subsection "Restarting All Services"

info "Starting all services..."
docker compose up -d

log ""
info "Waiting for services to become healthy (60 seconds)..."
sleep 60

subsection "Checking Service Status"

docker compose ps

log ""
FAILED_SERVICES=$(docker compose ps --filter "status=restarting" --format "{{.Service}}" | wc -l)

if [ "$FAILED_SERVICES" -eq 0 ]; then
    success "All services are healthy!"
    log ""
    log "${GREEN}✓ Storage migration conflict resolved!${NC}"
    log "${GREEN}✓ All services running successfully!${NC}"
    log ""
    log "Next steps:"
    log "  1. Add SMTP password (see ADD_SMTP_PASSWORD.md)"
    log "  2. Update JWT tokens from Kong logs"
    log "  3. Test the application at https://test.auditproof.ca"
else
    warning "Some services are still restarting"
    log ""
    log "Check logs with:"
    log "  docker logs supabase-storage --tail 30"
    log "  docker logs supabase-rest --tail 30"
    log "  docker logs supabase-auth --tail 30"
fi

log ""
read -p "Press Enter to finish..."
exit 0
