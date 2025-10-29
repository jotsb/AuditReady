#!/bin/bash

##############################################################################
# Main Script: Complete Database Rebuild
#
# This orchestrates all sub-scripts to perform a complete database rebuild
#
# Usage:
#   chmod +x scripts/rebuild-database.sh
#   ./scripts/rebuild-database.sh
#
##############################################################################

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

##############################################################################
# Display Header
##############################################################################

clear
log "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
log "${RED}║                                                            ║${NC}"
log "${RED}║        COMPLETE DATABASE WIPE AND REBUILD SCRIPT           ║${NC}"
log "${RED}║                                                            ║${NC}"
log "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
log ""
log "${YELLOW}⚠  THIS SCRIPT WILL:${NC}"
log ""
log "   ${RED}🗑  DELETE ALL DATA${NC} - Every table, every row, everything"
log "   ${RED}🗑  DROP ALL SCHEMAS${NC} - public, auth, storage, _supavisor, etc."
log "   ${YELLOW}🔑  Generate new encryption key${NC}"
log "   ${BLUE}📝  Apply all migrations from scratch${NC}"
log "   ${GREEN}🚀  Start all services fresh${NC}"
log "   ${GREEN}✓  Run comprehensive health checks${NC}"
log ""
log "${RED}════════════════════════════════════════════════════════════${NC}"
log "${RED}         THIS CANNOT BE UNDONE - ALL DATA WILL BE LOST      ${NC}"
log "${RED}════════════════════════════════════════════════════════════${NC}"
log ""
log "Log file: ${LOG_FILE}"
log ""
read -p "Type 'YES' to continue (anything else to abort): " CONFIRM

if [[ "$CONFIRM" != "YES" ]]; then
    log "${GREEN}Aborted. No changes made.${NC}"
    exit 0
fi

##############################################################################
# Execute All Steps
##############################################################################

# Track overall status
OVERALL_STATUS=0
BACKUP_FILE=""

# Step 1: Validate Environment
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 1/9: Environment Validation${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

if ! source "$SCRIPT_DIR/01-validate-environment.sh" || ! validate_environment; then
    log "${RED}✗ Environment validation failed. Aborting.${NC}"
    exit 1
fi

# Step 2: Backup
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 2/9: Configuration Backup${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

if ! source "$SCRIPT_DIR/02-backup.sh" || ! backup_configuration; then
    log "${RED}✗ Backup failed. Aborting.${NC}"
    exit 1
fi

# Get backup file location
if [ -f /tmp/last_backup_file.txt ]; then
    BACKUP_FILE=$(cat /tmp/last_backup_file.txt)
fi

# Step 3: Stop Services
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 3/9: Stopping Services${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

if ! source "$SCRIPT_DIR/03-stop-services.sh" || ! stop_services; then
    log "${RED}✗ Failed to stop services. Aborting.${NC}"
    exit 1
fi

# Step 4: Wipe Database
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 4/9: Database Wipe${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

if ! source "$SCRIPT_DIR/04-wipe-database.sh" || ! wipe_database; then
    log "${RED}✗ Database wipe failed. Aborting.${NC}"
    exit 1
fi

# Step 5: Update Encryption Key
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 5/9: Encryption Key Update${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

if ! source "$SCRIPT_DIR/05-update-encryption-key.sh" || ! update_encryption_key; then
    log "${RED}✗ Encryption key update failed. Aborting.${NC}"
    exit 1
fi

# Step 6: Apply Migrations
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 6/9: Applying Migrations${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

if ! source "$SCRIPT_DIR/06-apply-migrations.sh" || ! apply_migrations; then
    log "${YELLOW}⚠ Some migrations failed. Continuing...${NC}"
    OVERALL_STATUS=1
fi

# Step 7: Verify Schema
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 7/9: Schema Verification${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

source "$SCRIPT_DIR/07-verify-schema.sh"
verify_schema

# Step 8: Start Services
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 8/9: Starting Services${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

if ! source "$SCRIPT_DIR/08-start-services.sh" || ! start_services; then
    log "${RED}✗ Failed to start services${NC}"
    OVERALL_STATUS=1
fi

# Step 9: Health Check
log "\n${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
log "${MAGENTA}Starting Step 9/9: Health Check${NC}"
log "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

if ! source "$SCRIPT_DIR/09-health-check.sh" || ! health_check; then
    log "${YELLOW}⚠ Health check found issues${NC}"
    OVERALL_STATUS=1
fi

##############################################################################
# Final Summary
##############################################################################

log "\n${MAGENTA}╔════════════════════════════════════════════════════════════╗${NC}"
log "${MAGENTA}║                    OPERATION COMPLETE                      ║${NC}"
log "${MAGENTA}╚════════════════════════════════════════════════════════════╝${NC}\n"

if [ $OVERALL_STATUS -eq 0 ]; then
    log "${GREEN}✓ Database rebuilt successfully!${NC}"
else
    log "${YELLOW}⚠ Rebuild completed with warnings${NC}"
fi

log ""
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${CYAN}Next Steps:${NC}"
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""
log "1. ${YELLOW}Test your application${NC}"
log "   - Navigate to your frontend URL"
log "   - Try to sign up / log in"
log "   - Upload a test receipt"
log ""
log "2. ${YELLOW}Monitor logs if needed${NC}"
log "   ${BLUE}cd $DOCKER_DIR${NC}"
log "   ${BLUE}docker compose logs -f${NC}"
log ""
log "3. ${YELLOW}View specific service logs${NC}"
log "   ${BLUE}docker logs supabase-db${NC}"
log "   ${BLUE}docker logs supabase-pooler${NC}"
log "   ${BLUE}docker logs supabase-kong${NC}"
log ""
log "4. ${YELLOW}Clean up if everything works${NC}"
if [ -n "$BACKUP_FILE" ]; then
    log "   ${BLUE}rm $BACKUP_FILE${NC}"
fi
log "   ${BLUE}rm $LOG_FILE${NC}"
log ""
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${CYAN}Files Created:${NC}"
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "  📝 Log file: ${BLUE}$LOG_FILE${NC}"
if [ -n "$BACKUP_FILE" ]; then
    log "  💾 Backup: ${BLUE}$BACKUP_FILE${NC}"
fi
log ""
log "${GREEN}Database is ready for use!${NC}"
log ""

exit $OVERALL_STATUS
