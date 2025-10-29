#!/bin/bash

##############################################################################
# Step 6: Apply All Migrations
##############################################################################

source "$(dirname "$0")/00-config.sh"

apply_migrations() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 6: Applying All Migrations                           ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
    log "${YELLOW}Found ${MIGRATION_COUNT} migration files${NC}\n"

    MIGRATION_SUCCESS=0
    MIGRATION_FAILED=0
    FAILED_MIGRATIONS=()

    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            filename=$(basename "$migration_file")
            log "${BLUE}Applying: ${filename}${NC}"

            if docker exec -i supabase-db psql -U postgres -d postgres < "$migration_file" >> "$LOG_FILE" 2>&1; then
                log "${GREEN}  ✓ Success${NC}"
                MIGRATION_SUCCESS=$((MIGRATION_SUCCESS + 1))
            else
                log "${RED}  ✗ Failed${NC}"
                MIGRATION_FAILED=$((MIGRATION_FAILED + 1))
                FAILED_MIGRATIONS+=("$filename")
            fi
        fi
    done

    # Summary
    log ""
    log "${GREEN}Migrations applied: ${MIGRATION_SUCCESS}${NC}"

    if [ $MIGRATION_FAILED -gt 0 ]; then
        log "${RED}Migrations failed: ${MIGRATION_FAILED}${NC}"
        log "${YELLOW}Failed migrations:${NC}"
        for migration in "${FAILED_MIGRATIONS[@]}"; do
            log "  ${RED}✗ $migration${NC}"
        done
        log "${YELLOW}⚠ Check log file: $LOG_FILE${NC}"
        return 1
    else
        log "${GREEN}✓ All migrations applied successfully${NC}"
        return 0
    fi
}

# Run function when script is executed
apply_migrations
