#!/bin/bash

##############################################################################
# Step 4: Wipe Database
##############################################################################

source "$(dirname "$0")/00-config.sh"

wipe_database() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 4: Nuclear Database Wipe                             ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    cd "$DOCKER_DIR" || return 1

    # Start only database
    log "${YELLOW}Starting database container...${NC}"
    if ! docker compose up -d db >> "$LOG_FILE" 2>&1; then
        log "${RED}✗ Failed to start database${NC}"
        return 1
    fi

    sleep 8

    # Wait for database
    log "${YELLOW}Waiting for database to be ready...${NC}"
    for i in {1..30}; do
        if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
            log "${GREEN}✓ Database is ready${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            log "${RED}✗ Database failed to start${NC}"
            return 1
        fi
        echo -n "."
        sleep 1
    done

    # Wipe all schemas
    log "\n${RED}Dropping ALL schemas (except system schemas)...${NC}"
    docker exec -i supabase-db psql -U postgres -d postgres << 'EOF' 2>&1 | tee -a "$LOG_FILE"
\set ON_ERROR_STOP on

DO $$
DECLARE
    r RECORD;
    schema_count INTEGER := 0;
BEGIN
    FOR r IN (
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN (
            'pg_catalog', 'information_schema', 'pg_toast',
            'pg_temp_1', 'pg_toast_temp_1', 'pg_temp_2', 'pg_toast_temp_2'
        )
        ORDER BY schema_name
    ) LOOP
        RAISE NOTICE '  Dropping schema: %', r.schema_name;
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
        schema_count := schema_count + 1;
    END LOOP;
    RAISE NOTICE 'Dropped % schemas', schema_count;
END $$;

SELECT 'Remaining non-system schemas:' as info;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN (
    'pg_catalog', 'information_schema', 'pg_toast',
    'pg_temp_1', 'pg_toast_temp_1', 'pg_temp_2', 'pg_toast_temp_2'
)
ORDER BY schema_name;

SELECT 'Total non-system tables:' as info;
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast');
EOF

    if [ $? -eq 0 ]; then
        log "${GREEN}✓ Database wiped clean${NC}"
        return 0
    else
        log "${RED}✗ Failed to wipe database${NC}"
        return 1
    fi
}

# Run function when script is executed
wipe_database
