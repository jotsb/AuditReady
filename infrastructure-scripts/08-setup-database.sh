#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"
source /tmp/infrastructure_secrets.env

section "Step 8: Setting Up Database"

cd "$DOCKER_PATH"

subsection "Starting Database"
docker compose up -d db
sleep 10

for i in {1..30}; do
    if docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1; then
        success "Database ready"
        break
    fi
    sleep 2
done

subsection "Applying Migrations"
if [ -d "$PROJECT_MIGRATIONS" ]; then
    for migration in "$PROJECT_MIGRATIONS"/*.sql; do
        if [ -f "$migration" ]; then
            filename=$(basename "$migration")
            info "Applying: $filename"
            docker exec -i supabase-db psql -U postgres -d postgres < "$migration" || warning "Migration $filename had warnings"
        fi
    done
    success "Migrations applied"
fi

subsection "Creating Storage Buckets"
# Wait a bit more for services
sleep 5

docker exec -i supabase-db psql -U postgres -d postgres << 'SQLEOF'
-- Create receipts bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false,
    52428800,  -- 50MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

\echo 'Storage bucket created: receipts'
SQLEOF

success "Storage buckets created"

subsection "Creating Admin User"
# This will be done after auth service starts
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

    RAISE NOTICE 'Admin user created: $ADMIN_EMAIL';
END \$\$;
SQLEOF

info "Admin user script created (will be applied after auth starts)"

exit 0
