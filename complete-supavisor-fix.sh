#!/bin/bash

set -e

echo "================================================"
echo "Complete Supavisor Fix"
echo "================================================"
echo ""

DOCKER_DIR="/mnt/user/appdata/auditproof/supabase-src/docker"
ENV_FILE="/mnt/user/appdata/auditproof/supabase-project/.env"

# Stop the pooler
echo "1. Stopping Supavisor..."
cd "$DOCKER_DIR"
docker compose stop supabase-pooler

# Check what's in _supavisor schema
echo ""
echo "2. Checking _supavisor schema contents..."
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
SELECT 'Current _supavisor tables:' as info;
SELECT schemaname, tablename, n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = '_supavisor'
ORDER BY tablename;

SELECT 'Data in _supavisor.tenants:' as info;
SELECT COUNT(*) as tenant_count FROM _supavisor.tenants;

SELECT 'Data in _supavisor.db_passwords:' as info;
SELECT COUNT(*) as password_count FROM _supavisor.db_passwords;
EOF

# Delete old encrypted data
echo ""
echo "3. Deleting old encrypted data from _supavisor..."
docker exec -i supabase-db psql -U postgres -d postgres << 'EOF'
-- Truncate all data but keep schema structure
TRUNCATE TABLE _supavisor.tenants CASCADE;
TRUNCATE TABLE _supavisor.db_passwords CASCADE;

-- Also clear any other tables in the schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = '_supavisor'
        AND tablename NOT IN ('tenants', 'db_passwords')
    ) LOOP
        EXECUTE 'TRUNCATE TABLE _supavisor.' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Truncated table: %', r.tablename;
    END LOOP;
END $$;

SELECT 'Verification - all tables should have 0 rows:' as info;
SELECT schemaname, tablename, n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = '_supavisor'
ORDER BY tablename;
EOF

# Generate new encryption key (must be exactly 32 bytes)
echo ""
echo "4. Generating new encryption key (32 bytes = 64 hex chars)..."
NEW_KEY=$(openssl rand -hex 32)
echo "New key: ${NEW_KEY:0:20}... (64 chars total)"

# Update .env file
echo ""
echo "5. Updating .env file..."
if [ -f "$ENV_FILE" ]; then
    sed -i "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=$NEW_KEY|" "$ENV_FILE"
    echo "✓ Updated VAULT_ENC_KEY in $ENV_FILE"

    # Verify it was updated
    echo "Verification:"
    grep "^VAULT_ENC_KEY=" "$ENV_FILE" | head -c 40
    echo "..."
else
    echo "ERROR: .env file not found at $ENV_FILE"
    exit 1
fi

# Restart pooler with fresh state
echo ""
echo "6. Restarting Supavisor..."
cd "$DOCKER_DIR"
docker compose up -d supabase-pooler

echo ""
echo "7. Waiting for Supavisor to start..."
sleep 10

echo ""
echo "8. Checking Supavisor logs..."
docker logs supabase-pooler 2>&1 | tail -30

echo ""
echo "================================================"
echo "Fix Complete!"
echo "================================================"
echo ""
echo "Check for errors above. You should see:"
echo "  ✓ 'Proxy started' messages"
echo "  ✗ NO 'Unknown cipher or invalid key size' errors"
echo ""
echo "If still failing, the pooler may need a full service restart:"
echo "  cd $DOCKER_DIR"
echo "  docker compose down"
echo "  docker compose up -d"
echo ""
