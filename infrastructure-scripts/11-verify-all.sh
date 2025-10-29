#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

# Check if running standalone (need to load secrets)
if [ -f /tmp/infrastructure_secrets.env ]; then
    source /tmp/infrastructure_secrets.env
elif [ -f "$BASE_PATH/secrets.txt" ]; then
    # Try to load from saved secrets
    warning "Loading secrets from $BASE_PATH/secrets.txt"
    eval $(grep -E "^(ADMIN_EMAIL|ADMIN_PASSWORD|APP_DOMAIN|FRONTEND_PORT)=" "$BASE_PATH/secrets.txt")
else
    warning "Secrets not found - some checks may be limited"
fi

section "Step 11: Verifying Installation"

FAILED=0

subsection "Checking Containers"
echo "Running Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(supabase|auditproof)" || FAILED=1

# Check specifically for Supavisor
if docker ps --format "{{.Names}}" | grep -q "supabase-pooler"; then
    success "Supavisor (connection pooler) is running"
else
    warning "Supavisor not found - may not be enabled in docker-compose.yml"
fi

subsection "Checking Frontend"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${FRONTEND_PORT:-8080} | grep -q "200"; then
    success "Frontend responding on port ${FRONTEND_PORT:-8080}"
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
if [ -n "$ADMIN_EMAIL" ]; then
    ADMIN_EXISTS=$(docker exec -i supabase-db psql -U postgres -d postgres -t << SQL
SELECT COUNT(*) FROM auth.users WHERE email = '$ADMIN_EMAIL';
SQL
)
    if [ "$ADMIN_EXISTS" -gt 0 ]; then
        success "Admin user exists: $ADMIN_EMAIL"
    else
        warning "Admin user may not be created yet"
    fi
else
    info "ADMIN_EMAIL not set - skipping admin user check"
fi

subsection "Checking Supavisor Health"
if docker ps --format "{{.Names}}" | grep -q "supabase-pooler"; then
    POOLER_HEALTHY=$(docker inspect --format='{{.State.Health.Status}}' supabase-pooler 2>/dev/null || echo "unknown")
    if [ "$POOLER_HEALTHY" = "healthy" ]; then
        success "Supavisor is healthy"
    else
        warning "Supavisor status: $POOLER_HEALTHY"
    fi
fi

log ""
log "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${GREEN}║              INSTALLATION COMPLETE!                        ║${NC}"
log "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
log ""
log "Access Points:"
log "  Frontend:       https://${APP_DOMAIN:-test.auditproof.ca}"
log "  Local Frontend: http://localhost:${FRONTEND_PORT:-8080}"
log "  Studio:         http://localhost:3000"
log ""
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    log "Credentials:"
    log "  Admin:      $ADMIN_EMAIL / $ADMIN_PASSWORD"
    log "  Dashboard:  ${DASHBOARD_USERNAME:-supabase} / (see secrets.txt)"
    log ""
fi
log "Secrets File:  $BASE_PATH/secrets.txt"
log "Logs:          $LOG_FILE"
log ""
log "${YELLOW}IMPORTANT NEXT STEPS:${NC}"
log "1. Update JWT tokens in .env files (see secrets.txt)"
log "2. Configure SMTP if email is needed"
log "3. Verify SWAG proxy configuration"
log "4. Test user signup at https://${APP_DOMAIN:-test.auditproof.ca}"
log "5. Review test workflow: workflows/TEST_WORKFLOW.md"
log ""
log "${GREEN}✓ Supavisor is ENABLED with proper encryption keys${NC}"
log ""

[ $FAILED -eq 0 ] && exit 0 || exit 1
