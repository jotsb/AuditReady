#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"
source /tmp/infrastructure_secrets.env

section "Step 4: Configuring Environment Files"

info "Creating Docker .env file with ALL required variables..."
log "This includes settings for:"
log "  - Database configuration"
log "  - JWT secrets"
log "  - Supavisor (connection pooler)"
log "  - Vector (analytics)"
log "  - SMTP (email)"
log "  - Auth settings"
log ""

# Docker .env
cat > "$DOCKER_PATH/.env" << EOF
############
# Secrets
############
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
VAULT_ENC_KEY=$VAULT_ENC_KEY
SECRET_KEY_BASE=$SECRET_KEY_BASE
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD
PG_META_CRYPTO_KEY=$PG_META_CRYPTO_KEY
POOLER_TENANT_ID=$POOLER_TENANT_ID

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PORT=5432

############
# API
############
API_EXTERNAL_URL=$API_EXTERNAL_URL
SITE_URL=$SITE_URL

############
# Auth
############
DISABLE_SIGNUP=false
MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
MAILER_URLPATHS_INVITE="/auth/v1/verify"
MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false

############
# Email (SMTP)
############
SMTP_ADMIN_EMAIL=$SMTP_ADMIN_EMAIL
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_SENDER_NAME=$SMTP_SENDER_NAME
MAILER_AUTOCONFIRM=false

############
# Dashboard
############
DASHBOARD_USERNAME=$DASHBOARD_USERNAME
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD
STUDIO_DEFAULT_ORGANIZATION="AuditProof"
STUDIO_DEFAULT_PROJECT="Production"

############
# Supavisor (Connection Pooler)
############
REGION=$REGION
ERL_AFLAGS=$ERL_AFLAGS
CLUSTER_POSTGRES=$CLUSTER_POSTGRES
POOLER_DEFAULT_POOL_SIZE=$POOLER_DEFAULT_POOL_SIZE
POOLER_MAX_CLIENT_CONN=$POOLER_MAX_CLIENT_CONN
POOLER_DB_POOL_SIZE=$POOLER_DB_POOL_SIZE
POOLER_PROXY_PORT_TRANSACTION=$POOLER_PROXY_PORT_TRANSACTION

############
# Vector Analytics
############
LOGFLARE_PUBLIC_ACCESS_TOKEN=$LOGFLARE_PUBLIC_ACCESS_TOKEN
EOF

chmod 600 "$DOCKER_PATH/.env"
success "Docker .env configured with $(wc -l < "$DOCKER_PATH/.env") lines"
log "  ✓ All Supavisor variables included"
log "  ✓ Vector analytics token included"
log "  ✓ File permissions: 600 (secure)"
log ""

# Frontend .env
cat > "$PROJECT_PATH/.env" << EOF
VITE_SUPABASE_URL=$API_EXTERNAL_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
VITE_OPENAI_API_KEY=$OPENAI_API_KEY
VITE_APP_URL=$SITE_URL
EOF

chmod 600 "$PROJECT_PATH/.env"
success "Frontend .env configured"
log "  ✓ Supabase URL: $API_EXTERNAL_URL"
log "  ✓ OpenAI API configured"
log "  ✓ File permissions: 600 (secure)"
log ""
log "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${GREEN}║        ENVIRONMENT FILES CONFIGURED SUCCESSFULLY        ║${NC}"
log "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
log ""
read -p "Press Enter to continue..."
exit 0
