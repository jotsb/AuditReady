#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 1: Path Validation"

prompt_path() {
    local desc="$1" default="$2" var="$3"
    echo -e "${CYAN}$desc${NC}\n${YELLOW}Default: $default${NC}"
    read -p "Press Enter for default, or type new path: " user_path
    [ -z "$user_path" ] && eval "export $var=\"$default\"" || eval "export $var=\"${user_path/#\~/$HOME}\""
}

prompt_path "Base directory" "$DEFAULT_BASE_PATH" "BASE_PATH"
prompt_path "Project directory" "$DEFAULT_PROJECT_PATH" "PROJECT_PATH"
prompt_path "Supabase CLI directory" "$DEFAULT_SUPABASE_CLI_PATH" "SUPABASE_CLI_PATH"
prompt_path "Docker directory" "$DEFAULT_DOCKER_PATH" "DOCKER_PATH"

# Update derived paths
export VOLUMES_PATH="$DOCKER_PATH/volumes"
export CONFIG_PATH="$VOLUMES_PATH/config"
export DIST_PATH="$VOLUMES_PATH/dist"
export FUNCTIONS_PATH="$VOLUMES_PATH/functions"
export DB_PATH="$VOLUMES_PATH/db"
export PROJECT_DIST="$PROJECT_PATH/dist"
export PROJECT_FUNCTIONS="$SUPABASE_CLI_PATH/functions"
export PROJECT_MIGRATIONS="$SUPABASE_CLI_PATH/migrations"

# Validate and create
FAILED=0
for path in "$BASE_PATH" "$PROJECT_PATH" "$SUPABASE_CLI_PATH" "$DOCKER_PATH"; do
    if ! dir_exists "$path"; then error "Missing: $path"; FAILED=1; else success "Found: $path"; fi
done

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

[ $FAILED -eq 1 ] && exit 1
success "All paths validated!"
exit 0
