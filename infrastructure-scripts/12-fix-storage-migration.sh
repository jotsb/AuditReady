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
-- Simple CASCADE drop handles all dependencies automatically

DO $$
BEGIN
    -- Drop the function with CASCADE to remove all dependencies
    -- This automatically drops any policies, views, or triggers that depend on it
    DROP FUNCTION IF EXISTS storage.foldername(text) CASCADE;
    RAISE NOTICE 'Dropped foldername function with CASCADE';

    -- Also try to drop common storage policies that might exist
    BEGIN
        DROP POLICY IF EXISTS "folder list policy" ON storage.objects;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Policy "folder list policy" does not exist or already dropped';
    END;

    BEGIN
        DROP POLICY IF EXISTS "Users can view their own folders" ON storage.objects;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Policy "Users can view their own folders" does not exist or already dropped';
    END;

    RAISE NOTICE 'Storage migration conflict fixed!';
END $$;

-- Verify the function is gone
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 'SUCCESS: foldername function removed'
        ELSE 'WARNING: foldername function still exists'
    END as status
FROM pg_proc
WHERE proname = 'foldername'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage');
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
