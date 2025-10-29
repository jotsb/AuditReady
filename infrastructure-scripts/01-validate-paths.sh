#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 1: Path Validation"

log "${CYAN}This script will validate and configure all required paths.${NC}"
log ""
log "Default paths:"
log "  Base:       $DEFAULT_BASE_PATH"
log "  Project:    $DEFAULT_PROJECT_PATH"
log "  Supabase:   $DEFAULT_SUPABASE_CLI_PATH"
log "  Docker:     $DEFAULT_DOCKER_PATH"
log ""
read -p "Press Enter to use defaults, or type 'custom' to specify: " choice

if [ "$choice" = "custom" ]; then
    prompt_path() {
        local desc="$1" default="$2" var="$3"
        echo -e "${CYAN}$desc${NC}\n${YELLOW}Default: $default${NC}"
        read -p "Enter path (or press Enter for default): " user_path
        [ -z "$user_path" ] && eval "export $var=\"$default\"" || eval "export $var=\"${user_path/#\~/$HOME}\""
    }
    
    prompt_path "Base directory" "$DEFAULT_BASE_PATH" "BASE_PATH"
    prompt_path "Project directory" "$DEFAULT_PROJECT_PATH" "PROJECT_PATH"
    prompt_path "Supabase CLI directory" "$DEFAULT_SUPABASE_CLI_PATH" "SUPABASE_CLI_PATH"
    prompt_path "Docker directory" "$DEFAULT_DOCKER_PATH" "DOCKER_PATH"
else
    export BASE_PATH="$DEFAULT_BASE_PATH"
    export PROJECT_PATH="$DEFAULT_PROJECT_PATH"
    export SUPABASE_CLI_PATH="$DEFAULT_SUPABASE_CLI_PATH"
    export DOCKER_PATH="$DEFAULT_DOCKER_PATH"
    info "Using default paths"
fi

# Update derived paths
export VOLUMES_PATH="$DOCKER_PATH/volumes"
export CONFIG_PATH="$VOLUMES_PATH/config"
export DIST_PATH="$VOLUMES_PATH/dist"
export FUNCTIONS_PATH="$VOLUMES_PATH/functions"
export DB_PATH="$VOLUMES_PATH/db"
export PROJECT_DIST="$PROJECT_PATH/dist"
export PROJECT_FUNCTIONS="$SUPABASE_CLI_PATH/functions"
export PROJECT_MIGRATIONS="$SUPABASE_CLI_PATH/migrations"

log ""
subsection "Validating Paths"

# Validate and create
FAILED=0
for path in "$BASE_PATH" "$PROJECT_PATH" "$SUPABASE_CLI_PATH" "$DOCKER_PATH"; do
    if ! dir_exists "$path"; then 
        error "Missing: $path"
        FAILED=1
    else 
        success "Found: $path"
    fi
done

log ""
subsection "Creating Required Directories"

ensure_dir "$VOLUMES_PATH"
ensure_dir "$CONFIG_PATH"
ensure_dir "$DIST_PATH"
ensure_dir "$FUNCTIONS_PATH"
ensure_dir "$LOG_DIR"
ensure_dir "$BACKUP_DIR"

# Save config
cat > "$BASE_PATH/.infrastructure-paths" << EOF
BASE_PATH="$BASE_PATH"
PROJECT_PATH="$PROJECT_PATH"
SUPABASE_CLI_PATH="$SUPABASE_CLI_PATH"
DOCKER_PATH="$DOCKER_PATH"
VOLUMES_PATH="$VOLUMES_PATH"
EOF

log ""
if [ $FAILED -eq 1 ]; then
    error "Path validation failed! Please check paths and try again."
    exit 1
fi

log "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${GREEN}║           PATHS VALIDATED SUCCESSFULLY                     ║${NC}"
log "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
log ""
log "Configuration saved to: ${YELLOW}$BASE_PATH/.infrastructure-paths${NC}"
log ""
read -p "Press Enter to continue..."
exit 0
