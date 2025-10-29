#!/bin/bash

##############################################################################
# Nuclear Supavisor Fix - Remove ALL traces including Docker volumes
##############################################################################

source "$(dirname "$0")/00-config.sh"

nuclear_supavisor_fix() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Nuclear Supavisor Fix - Complete Removal                  ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    cd "$DOCKER_DIR" || return 1

    log "${RED}Stopping all services...${NC}"
    docker compose down >> "$LOG_FILE" 2>&1

    log "${RED}Removing Supavisor Docker volumes...${NC}"
    # Find and remove any Supavisor-related volumes
    SUPAVISOR_VOLUMES=$(docker volume ls -q | grep -i supavisor || true)
    if [ -n "$SUPAVISOR_VOLUMES" ]; then
        echo "$SUPAVISOR_VOLUMES" | while read volume; do
            log "${YELLOW}  Removing volume: $volume${NC}"
            docker volume rm "$volume" 2>> "$LOG_FILE" || true
        done
    else
        log "${GREEN}  No Supavisor volumes found${NC}"
    fi

    log "${YELLOW}Starting only database...${NC}"
    docker compose up -d db >> "$LOG_FILE" 2>&1
    sleep 5

    # Wait for database
    for i in {1..20}; do
        if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
            log "${GREEN}✓ Database is ready${NC}"
            break
        fi
        sleep 1
    done

    log "${RED}Dropping _supavisor schema completely...${NC}"
    docker exec -i supabase-db psql -U postgres -d postgres << 'EOF' 2>&1 | tee -a "$LOG_FILE"
-- Nuclear option: Drop EVERYTHING related to Supavisor
DROP SCHEMA IF EXISTS _supavisor CASCADE;

-- Drop the Supavisor migration tracking
DELETE FROM supabase_migrations.schema_migrations WHERE version LIKE '%supavisor%';

-- Verify it's gone
SELECT 'Remaining Supavisor objects:' as info;
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = '_supavisor' OR tablename LIKE '%supavisor%';

SELECT 'Schema count:' as info;
SELECT COUNT(*) as count FROM information_schema.schemata WHERE schema_name = '_supavisor';
EOF

    log "${GREEN}✓ Supavisor completely removed${NC}"
    log "${YELLOW}Stopping database...${NC}"
    docker compose down >> "$LOG_FILE" 2>&1

    return 0
}

# Run function when script is executed
nuclear_supavisor_fix
