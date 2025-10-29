#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 3: Generating All Secrets"

SECRETS_FILE="$BASE_PATH/secrets.txt"
ENV_SECRETS="/tmp/infrastructure_secrets.env"
> "$SECRETS_FILE"
> "$ENV_SECRETS"

# Database
export POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | head -c 32)
export POSTGRES_USER="postgres"
export POSTGRES_DB="postgres"
export POSTGRES_HOST="db"
export POSTGRES_PORT="5432"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
success "Generated POSTGRES_PASSWORD (32 chars)"

# JWT (64 hex chars = 32 bytes for HS256)
export JWT_SECRET=$(openssl rand -hex 32)
success "Generated JWT_SECRET (64 hex chars)"

# Encryption Keys
export VAULT_ENC_KEY=$(openssl rand -hex 32)
export SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d "=+/\n" | head -c 64)
export PG_META_CRYPTO_KEY=$(openssl rand -base64 32 | tr -d "=+/\n" | head -c 32)
success "Generated encryption keys (VAULT: 64 hex, SECRET_KEY_BASE: 64, PG_META: 32)"

# Placeholders for JWT tokens (will be updated after Kong starts)
export ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
export SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
warning "Using demo JWT tokens - update with real ones from Kong after start"

# Dashboard
export DASHBOARD_USERNAME="supabase"
export DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/\n" | head -c 16)
success "Generated DASHBOARD_PASSWORD (16 chars)"

# SMTP Configuration
export SMTP_ADMIN_EMAIL="admin@${APP_DOMAIN}"
export SMTP_HOST="mail.smtp2go.com"
export SMTP_PORT="587"
export SMTP_USER=""
export SMTP_PASS=""
export SMTP_SENDER_NAME="AuditProof"
warning "SMTP credentials are empty - configure manually if email is needed"

# URLs
export SITE_URL="https://${APP_DOMAIN}"
export API_EXTERNAL_URL="https://${APP_DOMAIN}"
export SUPABASE_PUBLIC_URL="https://${APP_DOMAIN}"

# Admin User
export ADMIN_EMAIL="admin@${APP_DOMAIN}"
export ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/\n" | head -c 16)
success "Generated ADMIN_PASSWORD (16 chars)"

# Supavisor Configuration
export POOLER_TENANT_ID=$(openssl rand -hex 16)
export REGION="local"
export ERL_AFLAGS="-proto_dist inet_tcp"
export CLUSTER_POSTGRES="true"
success "Generated Supavisor configuration (POOLER_TENANT_ID: 32 hex, REGION: local)"

# Save all secrets
cat > "$SECRETS_FILE" << EOF
################################################################################
# AuditProof Infrastructure Secrets
# Generated: $(date)
# KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT!
################################################################################

# Database
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=$DATABASE_URL

# JWT
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# Encryption
VAULT_ENC_KEY=$VAULT_ENC_KEY
SECRET_KEY_BASE=$SECRET_KEY_BASE
PG_META_CRYPTO_KEY=$PG_META_CRYPTO_KEY

# Dashboard
DASHBOARD_USERNAME=$DASHBOARD_USERNAME
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD

# Admin User
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

# OpenAI
OPENAI_API_KEY=$OPENAI_API_KEY

# SMTP (Configure if needed)
SMTP_ADMIN_EMAIL=$SMTP_ADMIN_EMAIL
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS

# Site Configuration
SITE_URL=$SITE_URL
API_EXTERNAL_URL=$API_EXTERNAL_URL
APP_DOMAIN=$APP_DOMAIN

# Supavisor
POOLER_TENANT_ID=$POOLER_TENANT_ID
REGION=$REGION
ERL_AFLAGS=$ERL_AFLAGS
CLUSTER_POSTGRES=$CLUSTER_POSTGRES

################################################################################
# IMPORTANT NOTES:
# 1. Update ANON_KEY and SERVICE_ROLE_KEY after services start
# 2. Configure SMTP credentials if email is needed
# 3. Backup this file securely
# 4. Supavisor is ENABLED with proper encryption keys
################################################################################
EOF

chmod 600 "$SECRETS_FILE"

# Export for other scripts
cat > "$ENV_SECRETS" << EOF
export POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
export DATABASE_URL="$DATABASE_URL"
export JWT_SECRET="$JWT_SECRET"
export ANON_KEY="$ANON_KEY"
export SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export VAULT_ENC_KEY="$VAULT_ENC_KEY"
export SECRET_KEY_BASE="$SECRET_KEY_BASE"
export PG_META_CRYPTO_KEY="$PG_META_CRYPTO_KEY"
export DASHBOARD_USERNAME="$DASHBOARD_USERNAME"
export DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD"
export ADMIN_EMAIL="$ADMIN_EMAIL"
export ADMIN_PASSWORD="$ADMIN_PASSWORD"
export OPENAI_API_KEY="$OPENAI_API_KEY"
export SMTP_ADMIN_EMAIL="$SMTP_ADMIN_EMAIL"
export SMTP_HOST="$SMTP_HOST"
export SMTP_PORT="$SMTP_PORT"
export SMTP_USER="$SMTP_USER"
export SMTP_PASS="$SMTP_PASS"
export SITE_URL="$SITE_URL"
export API_EXTERNAL_URL="$API_EXTERNAL_URL"
export APP_DOMAIN="$APP_DOMAIN"
export POOLER_TENANT_ID="$POOLER_TENANT_ID"
export REGION="$REGION"
export ERL_AFLAGS="$ERL_AFLAGS"
export CLUSTER_POSTGRES="$CLUSTER_POSTGRES"
EOF

source "$ENV_SECRETS"
success "Secrets generated and exported!"
log ""
log "Secrets saved to: $SECRETS_FILE"
log "Admin User: $ADMIN_EMAIL / $ADMIN_PASSWORD"
log ""
exit 0
