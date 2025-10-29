#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Resetting Infrastructure"

log "${RED}WARNING: This will DESTROY all data, containers, and volumes!${NC}"
log ""
read -p "Type 'DELETE EVERYTHING' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE EVERYTHING" ]; then
    log "Reset cancelled"
    exit 0
fi

subsection "Stopping All Containers"
cd "$DOCKER_PATH"
docker compose down -v
docker rm -f $FRONTEND_CONTAINER 2>/dev/null || true

subsection "Wiping Volumes"
rm -rf "$VOLUMES_PATH"/*
success "Volumes wiped"

subsection "Removing Secrets"
rm -f "$BASE_PATH/secrets.txt"
rm -f /tmp/infrastructure_secrets.env
rm -f /tmp/create_admin_user.sql

subsection "Restoring Backup (if available)"
if [ -f /tmp/last_backup_dir.txt ]; then
    BACKUP=$(cat /tmp/last_backup_dir.txt)
    if [ -d "$BACKUP" ]; then
        info "Restoring from: $BACKUP"
        cp -r "$BACKUP"/volumes/* "$VOLUMES_PATH/" 2>/dev/null || true
        cp "$BACKUP"/docker/.env "$DOCKER_PATH/" 2>/dev/null || true
        cp "$BACKUP"/docker/docker-compose.yml "$DOCKER_PATH/" 2>/dev/null || true
        success "Backup restored"
    fi
fi

success "Reset complete!"
log ""
log "To rebuild:"
log "  ./00-setup-infrastructure.sh"
log ""
