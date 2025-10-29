#!/bin/bash

set -e

echo "================================================"
echo "COMPLETE DATABASE WIPE - Starting Fresh"
echo "================================================"
echo ""
echo "WARNING: This will DELETE ALL DATA and ALL SCHEMAS"
echo "Press Ctrl+C within 5 seconds to cancel..."
sleep 5

DOCKER_DIR="/mnt/user/appdata/auditproof/supabase-project"
ENV_FILE="/mnt/user/appdata/auditproof/supabase-project/.env"

# Stop all Supabase services
echo ""
echo "1. Stopping all Supabase services..."
cd "$DOCKER_DIR"
docker compose down

echo ""
echo "2. Wiping entire database..."
docker compose up -d supabase-db
sleep 5

# Nuclear option - drop everything
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
-- Drop all schemas except system ones
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all non-system schemas
    FOR r IN (
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
    ) LOOP
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
        RAISE NOTICE 'Dropped schema: %', r.schema_name;
    END LOOP;
END $$;

-- Verify all schemas are gone
SELECT 'Remaining schemas:' as info;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
ORDER BY schema_name;

-- Show table count (should be 0)
SELECT 'Total non-system tables:' as info;
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast');
EOF

echo ""
echo "3. Generating new encryption key..."
NEW_KEY=$(openssl rand -hex 32)
echo "New VAULT_ENC_KEY: ${NEW_KEY:0:20}... (64 chars)"

echo ""
echo "4. Updating .env file..."
if [ -f "$ENV_FILE" ]; then
    sed -i "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=$NEW_KEY|" "$ENV_FILE"
    echo "✓ Updated VAULT_ENC_KEY"
else
    echo "ERROR: .env file not found at $ENV_FILE"
    exit 1
fi

echo ""
echo "5. Starting all Supabase services..."
cd "$DOCKER_DIR"
docker compose up -d

echo ""
echo "6. Waiting for services to start..."
sleep 15

echo ""
echo "7. Verifying empty database..."
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
SELECT 'Schemas in database:' as info;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
ORDER BY schema_name;

SELECT 'Total tables:' as info;
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast');
EOF

echo ""
echo "8. Checking Supavisor logs..."
docker logs supabase-pooler 2>&1 | tail -20

echo ""
echo "================================================"
echo "Database Completely Wiped!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Your database is now completely empty"
echo "2. Apply your migrations to rebuild the schema"
echo "3. If Supavisor still has errors, just disable it:"
echo "   docker compose stop supabase-pooler"
echo "   docker update --restart=no supabase-pooler"
echo ""
