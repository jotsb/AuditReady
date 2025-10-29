#!/bin/bash

##############################################################################
# Step 7: Verify Database Schema
##############################################################################

source "$(dirname "$0")/00-config.sh"

verify_schema() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 7: Verifying Database Schema                         ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    log "${YELLOW}Checking created schemas...${NC}"
    docker exec -i supabase-db psql -U postgres -d postgres << 'EOF' 2>&1 | tee -a "$LOG_FILE"
SELECT 'Created Schemas:' as info;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN (
    'pg_catalog', 'information_schema', 'pg_toast',
    'pg_temp_1', 'pg_toast_temp_1', 'pg_temp_2', 'pg_toast_temp_2'
)
ORDER BY schema_name;

SELECT 'Tables per schema:' as info;
SELECT
    table_schema,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
GROUP BY table_schema
ORDER BY table_schema;
EOF

    log "${GREEN}✓ Schema verification complete${NC}"
    return 0
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" -eq "${0}" ]; then
    verify_schema
fi
