#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 2: Backing Up Configuration"

ensure_dir "$BACKUP_DIR"

# Backup Docker config
[ -f "$DOCKER_PATH/docker-compose.yml" ] && backup_item "$DOCKER_PATH/docker-compose.yml" "$BACKUP_DIR/docker/docker-compose.yml"
[ -f "$DOCKER_PATH/.env" ] && backup_item "$DOCKER_PATH/.env" "$BACKUP_DIR/docker/.env"

# Backup volumes
[ -d "$CONFIG_PATH" ] && backup_item "$CONFIG_PATH" "$BACKUP_DIR/volumes/config"
[ -d "$FUNCTIONS_PATH" ] && backup_item "$FUNCTIONS_PATH" "$BACKUP_DIR/volumes/functions"
[ -d "$DIST_PATH" ] && backup_item "$DIST_PATH" "$BACKUP_DIR/volumes/dist"

# Backup project env
[ -f "$PROJECT_PATH/.env" ] && backup_item "$PROJECT_PATH/.env" "$BACKUP_DIR/project/.env"

echo "$BACKUP_DIR" > /tmp/last_backup_dir.txt
success "Backup complete: $BACKUP_DIR"
exit 0
