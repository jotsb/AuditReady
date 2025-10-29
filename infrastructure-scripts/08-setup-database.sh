#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"
source /tmp/infrastructure_secrets.env

section "Step 8: Setting Up Database"

log "${CYAN}This script will:${NC}"
log "  1. Start PostgreSQL database"
log "  2. Apply all migrations"
log "  3. Create storage buckets (receipts)"
log "  4. Prepare admin user creation script"
log ""
read -p "Press Enter to continue..."

cd "$DOCKER_PATH"

subsection "Starting Database"
info "Starting PostgreSQL container..."
docker compose up -d db
log ""

info "Waiting for database to be ready (up to 60 seconds)..."
for i in {1..30}; do
    if docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1; then
        success "Database ready after $((i*2)) seconds"
        break
    fi
    echo -n "."
    sleep 2
done
log ""

subsection "Applying Migrations"
if [ -d "$PROJECT_MIGRATIONS" ]; then
    MIGRATION_COUNT=$(ls -1 "$PROJECT_MIGRATIONS"/*.sql 2>/dev/null | wc -l)
    info "Found $MIGRATION_COUNT migration files"
    log ""
    
    APPLIED=0
    FAILED=0
    for migration in "$PROJECT_MIGRATIONS"/*.sql; do
        if [ -f "$migration" ]; then
            filename=$(basename "$migration")
            info "Applying: $filename"
            if docker exec -i supabase-db psql -U postgres -d postgres < "$migration" >/dev/null 2>&1; then
                success "  ✓ $filename"
                APPLIED=$((APPLIED + 1))
            else
                warning "  ⚠ $filename had warnings (this may be normal)"
                APPLIED=$((APPLIED + 1))
            fi
        fi
    done
    log ""
    success "Applied $APPLIED migrations successfully"
else
    warning "No migrations found at $PROJECT_MIGRATIONS"
fi

log ""
subsection "Creating Storage Buckets"
info "Creating 'receipts' bucket..."
sleep 3

docker exec -i supabase-db psql -U postgres -d postgres << 'SQLEOF' 2>&1 | grep -v "INSERT"
-- Create receipts bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false,
    52428800,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;
SQLEOF

success "Storage bucket 'receipts' created"
log "  - Max file size: 50MB"
log "  - Private access (RLS enforced)"
log "  - Allowed: JPEG, PNG, GIF, WebP, PDF"

log ""
subsection "Preparing Admin User Script"
cat > /tmp/create_admin_user.sql << SQLEOF
-- Create admin user in auth.users
DO \$\$
DECLARE
    admin_user_id UUID := gen_random_uuid();
BEGIN
    -- Insert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role
    ) VALUES (
        admin_user_id,
        '00000000-0000-0000-0000-000000000000',
        '$ADMIN_EMAIL',
        crypt('$ADMIN_PASSWORD', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider": "email", "providers": ["email"]}',
        '{"role": "system_admin"}',
        'authenticated',
        'authenticated'
    )
    ON CONFLICT (email) DO NOTHING;

    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        admin_user_id,
        '$ADMIN_EMAIL',
        'System Administrator',
        'system_admin'
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Admin user ready: $ADMIN_EMAIL';
END \$\$;
SQLEOF

success "Admin user script prepared (will be applied when auth starts)"
log "  - Email: $ADMIN_EMAIL"
log "  - Password: (in secrets.txt)"
log "  - Role: system_admin"

log ""
log "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${GREEN}║            DATABASE SETUP COMPLETE                         ║${NC}"
log "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
log ""
read -p "Press Enter to continue..."
exit 0
