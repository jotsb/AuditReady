#!/bin/bash

##############################################################################
# Step 1: Validate Environment
##############################################################################

source "$(dirname "$0")/00-config.sh"

validate_environment() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 1: Validating Environment                            ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    local has_errors=0

    # Check required commands
    log "${YELLOW}Checking required commands...${NC}"
    for cmd in docker openssl sed grep; do
        if command_exists "$cmd"; then
            log "${GREEN}✓ $cmd found${NC}"
        else
            log "${RED}✗ $cmd not found${NC}"
            has_errors=1
        fi
    done

    # Check paths
    log "\n${YELLOW}Checking paths...${NC}"

    if [ ! -f "$ENV_FILE" ]; then
        log "${RED}✗ .env file not found at: $ENV_FILE${NC}"
        has_errors=1
    else
        log "${GREEN}✓ Found .env file${NC}"
    fi

    if [ ! -d "$DOCKER_DIR" ]; then
        log "${RED}✗ Docker directory not found at: $DOCKER_DIR${NC}"
        has_errors=1
    else
        log "${GREEN}✓ Found Docker directory${NC}"
    fi

    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log "${RED}✗ Migrations directory not found at: $MIGRATIONS_DIR${NC}"
        has_errors=1
    else
        MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
        log "${GREEN}✓ Found migrations directory with ${MIGRATION_COUNT} files${NC}"
    fi

    # Check .env file contents
    log "\n${YELLOW}Validating .env configuration...${NC}"

    local missing_required=0
    local missing_recommended=0

    # Check required variables
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if grep -q "^${var}=" "$ENV_FILE" && [ -n "$(grep "^${var}=" "$ENV_FILE" | cut -d= -f2)" ]; then
            log "${GREEN}✓ $var is set${NC}"
        else
            log "${RED}✗ $var is missing or empty${NC}"
            missing_required=$((missing_required + 1))
            has_errors=1
        fi
    done

    # Check recommended variables
    log "\n${YELLOW}Checking recommended variables...${NC}"
    for var in "${RECOMMENDED_ENV_VARS[@]}"; do
        if grep -q "^${var}=" "$ENV_FILE" && [ -n "$(grep "^${var}=" "$ENV_FILE" | cut -d= -f2)" ]; then
            log "${GREEN}✓ $var is set${NC}"
        else
            log "${YELLOW}⚠ $var is missing (optional but recommended)${NC}"
            missing_recommended=$((missing_recommended + 1))
        fi
    done

    # Validate specific values
    log "\n${YELLOW}Validating specific configurations...${NC}"

    # Check VAULT_ENC_KEY length
    local vault_key=$(grep "^VAULT_ENC_KEY=" "$ENV_FILE" | cut -d= -f2)
    if [ -n "$vault_key" ]; then
        local key_length=${#vault_key}
        if [ $key_length -eq 64 ]; then
            log "${GREEN}✓ VAULT_ENC_KEY has correct length (64 chars)${NC}"
        else
            log "${RED}✗ VAULT_ENC_KEY has incorrect length (${key_length} chars, should be 64)${NC}"
            log "${YELLOW}  Will be regenerated during rebuild${NC}"
        fi
    fi

    # Check JWT_SECRET strength (should be at least 32 chars)
    local jwt_secret=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d= -f2)
    if [ -n "$jwt_secret" ]; then
        local jwt_length=${#jwt_secret}
        if [ $jwt_length -ge 32 ]; then
            log "${GREEN}✓ JWT_SECRET has sufficient length (${jwt_length} chars)${NC}"
        else
            log "${YELLOW}⚠ JWT_SECRET is short (${jwt_length} chars, recommend 32+)${NC}"
        fi
    fi

    # Check POSTGRES_PASSWORD strength
    local pg_pass=$(grep "^POSTGRES_PASSWORD=" "$ENV_FILE" | cut -d= -f2)
    if [ -n "$pg_pass" ]; then
        local pg_length=${#pg_pass}
        if [ $pg_length -ge 20 ]; then
            log "${GREEN}✓ POSTGRES_PASSWORD has sufficient length (${pg_length} chars)${NC}"
        else
            log "${YELLOW}⚠ POSTGRES_PASSWORD is short (${pg_length} chars, recommend 20+)${NC}"
        fi
    fi

    # Check Docker is running
    log "\n${YELLOW}Checking Docker service...${NC}"
    if docker ps >/dev/null 2>&1; then
        log "${GREEN}✓ Docker is running${NC}"
    else
        log "${RED}✗ Docker is not running or not accessible${NC}"
        has_errors=1
    fi

    # Summary
    log "\n${CYAN}════════════════════════════════════════════════════════════${NC}"
    if [ $has_errors -eq 0 ]; then
        log "${GREEN}✓ Environment validation passed${NC}"
        if [ $missing_recommended -gt 0 ]; then
            log "${YELLOW}⚠ ${missing_recommended} recommended variable(s) missing${NC}"
            log "${YELLOW}  Email features may not work without SMTP configuration${NC}"
        fi
        log "${CYAN}════════════════════════════════════════════════════════════${NC}"
        return 0
    else
        log "${RED}✗ Environment validation failed with $has_errors error(s)${NC}"
        log "${CYAN}════════════════════════════════════════════════════════════${NC}"
        return 1
    fi
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" -eq "${0}" ]; then
    validate_environment
fi
