#!/bin/bash

##############################################################################
# Step 8: Start All Services
##############################################################################

source "$(dirname "$0")/00-config.sh"

start_services() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 8: Starting All Services                             ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    cd "$DOCKER_DIR" || return 1

    log "${YELLOW}Stopping database...${NC}"
    docker compose down >> "$LOG_FILE" 2>&1

    log "${YELLOW}Starting all Supabase services...${NC}"
    if docker compose up -d >> "$LOG_FILE" 2>&1; then
        log "${GREEN}✓ Services started${NC}"
    else
        log "${RED}✗ Failed to start services${NC}"
        return 1
    fi

    log "${YELLOW}Waiting for services to initialize (20 seconds)...${NC}"
    for i in {1..20}; do
        echo -n "."
        sleep 1
    done
    log ""

    log "${GREEN}✓ All services started${NC}"
    return 0
}

# Run function when script is executed
start_services
