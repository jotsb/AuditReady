#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"
source /tmp/infrastructure_secrets.env

section "Step 11: Verifying Installation"

FAILED=0

subsection "Checking Containers"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(supabase|auditproof)" || FAILED=1

subsection "Checking Frontend"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT | grep -q "200"; then
    success "Frontend responding on port $FRONTEND_PORT"
else
    error "Frontend not responding"
    FAILED=1
fi

subsection "Checking Database"
if docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1; then
    success "Database ready"
else
    error "Database not ready"
    FAILED=1
fi

subsection "Checking Admin User"
ADMIN_EXISTS=$(docker exec -i supabase-db psql -U postgres -d postgres -t << SQL
SELECT COUNT(*) FROM auth.users WHERE email = '$ADMIN_EMAIL';
SQL
)

if [ "$ADMIN_EXISTS" -gt 0 ]; then
    success "Admin user exists: $ADMIN_EMAIL"
else
    warning "Admin user may not be created yet"
fi

log ""
log "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${GREEN}║              INSTALLATION COMPLETE!                        ║${NC}"
log "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
log ""
log "Access Points:"
log "  Frontend:      https://$APP_DOMAIN"
log "  Local Frontend: http://localhost:$FRONTEND_PORT"
log "  Studio:        http://localhost:3000"
log ""
log "Credentials:"
log "  Admin:      $ADMIN_EMAIL / $ADMIN_PASSWORD"
log "  Dashboard:  $DASHBOARD_USERNAME / $DASHBOARD_PASSWORD"
log ""
log "Secrets File:  $SECRETS_FILE"
log "Logs:          $LOG_FILE"
log ""
log "${YELLOW}IMPORTANT NEXT STEPS:${NC}"
log "1. Update JWT tokens in .env files (see secrets.txt)"
log "2. Configure SMTP if email is needed"
log "3. Verify SWAG proxy configuration"
log "4. Test user signup at https://$APP_DOMAIN"
log "5. Review test workflow: workflows/TEST_WORKFLOW.md"
log ""

[ $FAILED -eq 0 ] && exit 0 || exit 1
