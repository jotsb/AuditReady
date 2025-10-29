#!/bin/bash

##############################################################################
# Step 9: Comprehensive Health Check
##############################################################################

source "$(dirname "$0")/00-config.sh"

health_check() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 9: Health Check                                      ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    local has_errors=0

    # Check container status
    log "${YELLOW}Checking container status...${NC}"
    cd "$DOCKER_DIR" || return 1
    docker compose ps | tee -a "$LOG_FILE"

    # Check database connection
    log "\n${YELLOW}Testing database connection...${NC}"
    if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
        log "${GREEN}✓ Database is accepting connections${NC}"
    else
        log "${RED}✗ Database not responding${NC}"
        has_errors=1
    fi

    # Check auth schema
    log "\n${YELLOW}Checking authentication system...${NC}"
    AUTH_CHECK=$(docker exec -i supabase-db psql -U postgres -d postgres -tA -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users');" 2>/dev/null || echo "f")
    if [ "$AUTH_CHECK" == "t" ]; then
        log "${GREEN}✓ Auth schema exists${NC}"
    else
        log "${RED}✗ Auth schema missing${NC}"
        has_errors=1
    fi

    # Check storage schema
    log "\n${YELLOW}Checking storage system...${NC}"
    STORAGE_CHECK=$(docker exec -i supabase-db psql -U postgres -d postgres -tA -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets');" 2>/dev/null || echo "f")
    if [ "$STORAGE_CHECK" == "t" ]; then
        log "${GREEN}✓ Storage schema exists${NC}"
    else
        log "${RED}✗ Storage schema missing${NC}"
        has_errors=1
    fi

    # Check public schema
    log "\n${YELLOW}Checking public schema...${NC}"
    PUBLIC_CHECK=$(docker exec -i supabase-db psql -U postgres -d postgres -tA -c "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='public');" 2>/dev/null || echo "f")
    if [ "$PUBLIC_CHECK" == "t" ]; then
        log "${GREEN}✓ Public schema exists${NC}"
    else
        log "${RED}✗ Public schema missing${NC}"
        has_errors=1
    fi

    # Check Supavisor
    log "\n${YELLOW}Checking Supavisor (pooler) status...${NC}"
    if docker ps | grep -q "supabase-pooler"; then
        POOLER_LOGS=$(docker logs supabase-pooler 2>&1 | tail -30)

        if echo "$POOLER_LOGS" | grep -q "Unknown cipher or invalid key size"; then
            log "${RED}✗ Supavisor has encryption errors${NC}"
            log "${YELLOW}Last 30 lines of Supavisor logs:${NC}"
            echo "$POOLER_LOGS" | tee -a "$LOG_FILE"
            has_errors=1
        elif echo "$POOLER_LOGS" | grep -q "Proxy started"; then
            log "${GREEN}✓ Supavisor started successfully${NC}"
        else
            log "${YELLOW}⚠ Supavisor status unclear${NC}"
        fi
    else
        log "${RED}✗ Supavisor container not running${NC}"
        has_errors=1
    fi

    # Check API health
    log "\n${YELLOW}Checking API endpoints...${NC}"

    # Try to reach Kong (API Gateway)
    if docker ps | grep -q "supabase-kong"; then
        log "${GREEN}✓ Kong (API Gateway) is running${NC}"
    else
        log "${RED}✗ Kong (API Gateway) not running${NC}"
        has_errors=1
    fi

    # Check Studio
    if docker ps | grep -q "supabase-studio"; then
        log "${GREEN}✓ Studio is running${NC}"
    else
        log "${RED}✗ Studio not running${NC}"
        has_errors=1
    fi

    # Summary
    log "\n${CYAN}════════════════════════════════════════════════════════════${NC}"
    if [ $has_errors -eq 0 ]; then
        log "${GREEN}✓ All health checks passed${NC}"
        log "${CYAN}════════════════════════════════════════════════════════════${NC}"
        return 0
    else
        log "${RED}✗ Health check failed with errors${NC}"
        log "${YELLOW}⚠ Some services may not be working correctly${NC}"
        log "${CYAN}════════════════════════════════════════════════════════════${NC}"
        return 1
    fi
}

# Run function when script is executed
health_check
