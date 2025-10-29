#!/bin/bash

##############################################################################
# Step 10: Clear Supavisor Encrypted Data
##############################################################################

source "$(dirname "$0")/00-config.sh"

clear_supavisor() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 10: Clearing Supavisor Encrypted Data                ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    log "${YELLOW}Checking for Supavisor schema and data...${NC}"

    # Clear all Supavisor data
    docker exec -i supabase-db psql -U postgres -d postgres << 'EOF' 2>&1 | tee -a "$LOG_FILE"
-- Drop the entire _supavisor schema if it exists
DROP SCHEMA IF EXISTS _supavisor CASCADE;

-- Also check for any supavisor-related tables in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE '%supavisor%'
    ) LOOP
        RAISE NOTICE 'Dropping table: public.%', r.tablename;
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Clear any vault data that might contain encrypted supavisor info
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'vault' AND table_name = 'secrets') THEN
        DELETE FROM vault.secrets WHERE name LIKE '%supavisor%' OR name LIKE '%pooler%';
        RAISE NOTICE 'Cleared vault.secrets for supavisor';
    END IF;
END $$;

SELECT 'Supavisor cleanup complete' as status;
EOF

    if [ $? -eq 0 ]; then
        log "${GREEN}✓ Supavisor data cleared${NC}"
        return 0
    else
        log "${RED}✗ Failed to clear Supavisor data${NC}"
        return 1
    fi
}

# Run function when script is executed
clear_supavisor
