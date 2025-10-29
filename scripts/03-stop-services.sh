#!/bin/bash

##############################################################################
# Step 3: Stop All Services
##############################################################################

source "$(dirname "$0")/00-config.sh"

stop_services() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 3: Stopping All Supabase Services                    ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    cd "$DOCKER_DIR" || return 1

    log "${YELLOW}Stopping all services...${NC}"
    if docker compose down >> "$LOG_FILE" 2>&1; then
        log "${GREEN}✓ All services stopped${NC}"
        return 0
    else
        log "${RED}✗ Failed to stop services${NC}"
        return 1
    fi
}

# Run function when script is executed
stop_services
