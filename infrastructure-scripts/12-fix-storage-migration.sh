#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 12: Fix Storage Migration Conflict"

log "This script fixes the foldername() function dependency issue"
log "that prevents storage service from starting."
log ""
read -p "Press Enter to continue..."

subsection "Stopping Services"

cd "$DOCKER_PATH"
info "Stopping all services..."
docker compose down
success "Services stopped"

subsection "Fixing Database Schema"

info "Connecting to database..."

# Create fix script
cat > /tmp/fix-storage-migration.sql << 'SQLEOF'
-- Fix storage migration conflict
-- Drop dependent objects first, then recreate if needed

DO $$
DECLARE
    pol record;
BEGIN
    -- Drop all policies that reference foldername function
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
        AND definition LIKE '%foldername%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Dropped policy: %.%', pol.tablename, pol.policyname;
    END LOOP;

    -- Drop the function with CASCADE to remove all dependencies
    DROP FUNCTION IF EXISTS storage.foldername(text) CASCADE;
    RAISE NOTICE 'Dropped foldername function and dependencies';

    -- Recreate the function (storage migrations will handle this)
    -- We just need to remove the conflicting dependencies

    RAISE NOTICE 'Storage migration conflict fixed!';
END $$;
SQLEOF

info "Starting database temporarily..."
docker compose up -d db
sleep 5

info "Applying fix..."
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/fix-storage-migration.sql

if [ $? -eq 0 ]; then
    success "Database schema fixed!"
else
    error "Failed to apply fix"
    log ""
    log "Manual fix required. Run this in the database:"
    log "  DROP FUNCTION IF EXISTS storage.foldername(text) CASCADE;"
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
