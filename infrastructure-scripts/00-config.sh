#!/bin/bash

##############################################################################
# Shared Configuration for AuditProof Infrastructure Setup
##############################################################################

set -e

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export MAGENTA='\033[0;35m'
export CYAN='\033[0;36m'
export NC='\033[0m'

# Default Paths
export DEFAULT_BASE_PATH="/mnt/user/appdata/auditproof"
export DEFAULT_PROJECT_PATH="$DEFAULT_BASE_PATH/project/AuditReady"
export DEFAULT_DOCKER_PATH="$DEFAULT_BASE_PATH/supabase-project"

export BASE_PATH="${BASE_PATH:-$DEFAULT_BASE_PATH}"
export PROJECT_PATH="${PROJECT_PATH:-$DEFAULT_PROJECT_PATH}"
export DOCKER_PATH="${DOCKER_PATH:-$DEFAULT_DOCKER_PATH}"

# Derived Paths
export VOLUMES_PATH="$DOCKER_PATH/volumes"
export CONFIG_PATH="$VOLUMES_PATH/config"
export DIST_PATH="$VOLUMES_PATH/dist"
export FUNCTIONS_PATH="$VOLUMES_PATH/functions"
export DB_PATH="$VOLUMES_PATH/db"

export PROJECT_DIST="$PROJECT_PATH/dist"
export PROJECT_FUNCTIONS="$PROJECT_PATH/supabase/functions"
export PROJECT_MIGRATIONS="$PROJECT_PATH/supabase/migrations"

# Backup Configuration
export BACKUP_DIR="$BASE_PATH/backups/infrastructure_$(date +%Y%m%d_%H%M%S)"
export BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Application Configuration
export APP_DOMAIN="test.auditproof.ca"
export FRONTEND_PORT=8080
export FRONTEND_CONTAINER="auditproof-frontend"
export DOCKER_NETWORK="supabase-project_default"

# OpenAI API Key
export OPENAI_API_KEY="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"

# Logging
export LOG_DIR="$BASE_PATH/logs"
export LOG_FILE="$LOG_DIR/infrastructure_setup_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

# Functions
log() { echo -e "$@" | tee -a "$LOG_FILE"; }
error() { log "${RED}ERROR: $@${NC}"; }
success() { log "${GREEN}✓ $@${NC}"; }
warning() { log "${YELLOW}⚠ $@${NC}"; }
info() { log "${CYAN}ℹ $@${NC}"; }
section() { log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}\n${MAGENTA}$@${NC}\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}\n"; }
subsection() { log "\n${CYAN}───────────────────────────────────────────────────────────${NC}\n${CYAN}$@${NC}\n${CYAN}───────────────────────────────────────────────────────────${NC}\n"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }
dir_exists() { [ -d "$1" ]; }
file_exists() { [ -f "$1" ]; }
ensure_dir() { if ! dir_exists "$1"; then mkdir -p "$1"; success "Created directory: $1"; fi; }

backup_item() {
    local item="$1"
    local backup_path="$2"
    if [ -e "$item" ]; then
        ensure_dir "$(dirname "$backup_path")"
        cp -r "$item" "$backup_path"
        success "Backed up: $item -> $backup_path"
        return 0
    else
        warning "Item does not exist (skipping backup): $item"
        return 1
    fi
}

generate_random() {
    local length="${1:-32}"
    openssl rand -hex "$length" | head -c "$length"
}

generate_random_base64() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -d "=+/" | head -c "$length"
}

log "${BLUE}════════════════════════════════════════════════════════════${NC}"
log "${BLUE}   AuditProof Infrastructure Setup Configuration Loaded    ${NC}"
log "${BLUE}════════════════════════════════════════════════════════════${NC}\n"
