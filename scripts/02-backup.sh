#!/bin/bash

##############################################################################
# Step 2: Backup Configuration
##############################################################################

source "$(dirname "$0")/00-config.sh"

backup_configuration() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 2: Backing Up Configuration                          ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

    if cp "$ENV_FILE" "$BACKUP_FILE"; then
        log "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
        echo "$BACKUP_FILE" > /tmp/last_backup_file.txt
        return 0
    else
        log "${RED}✗ Failed to create backup${NC}"
        return 1
    fi
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" -eq "${0}" ]; then
    backup_configuration
fi
