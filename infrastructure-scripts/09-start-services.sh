#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 9: Starting Supabase Services"

cd "$DOCKER_PATH"

subsection "Verifying Supavisor Configuration"
if grep -q "^  supavisor:" docker-compose.yml 2>/dev/null; then
    success "Supavisor is enabled in docker-compose.yml"
    info "Supavisor will start with proper encryption keys"
else
    warning "Supavisor not found in docker-compose.yml"
fi

subsection "Starting All Services (Including Supavisor)"
docker compose down
sleep 3
docker compose up -d

info "Waiting for services to initialize (30 seconds)..."
sleep 30

subsection "Creating Admin User"
if [ -f /tmp/create_admin_user.sql ]; then
    docker exec -i supabase-db psql -U postgres -d postgres < /tmp/create_admin_user.sql
    success "Admin user created"
fi

success "Services started"
exit 0
