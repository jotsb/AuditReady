#!/bin/bash

##############################################################################
# Configuration File - Shared by All Scripts
##############################################################################

# Color codes
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export MAGENTA='\033[0;35m'
export NC='\033[0m'

# Paths
export BASE_DIR="/mnt/user/appdata/auditproof"
export ENV_FILE="$BASE_DIR/supabase-project/.env"
export DOCKER_DIR="$BASE_DIR/supabase-src/docker"
export MIGRATIONS_DIR="./supabase/migrations"
export LOG_FILE="/tmp/database-rebuild-$(date +%Y%m%d_%H%M%S).log"

# Required environment variables
export REQUIRED_ENV_VARS=(
    "POSTGRES_PASSWORD"
    "JWT_SECRET"
    "ANON_KEY"
    "SERVICE_ROLE_KEY"
    "DASHBOARD_USERNAME"
    "DASHBOARD_PASSWORD"
    "VAULT_ENC_KEY"
    "POSTGRES_HOST"
    "POSTGRES_DB"
    "POSTGRES_PORT"
    "SITE_URL"
    "API_EXTERNAL_URL"
)

# Optional but recommended variables
export RECOMMENDED_ENV_VARS=(
    "SMTP_HOST"
    "SMTP_PORT"
    "SMTP_USER"
    "SMTP_PASS"
    "SMTP_SENDER_NAME"
)

##############################################################################
# Helper Functions
##############################################################################

# Log to both screen and file
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Log command output
log_cmd() {
    "$@" 2>&1 | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log "${RED}ERROR: This script must be run as root${NC}"
        exit 1
    fi
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}
