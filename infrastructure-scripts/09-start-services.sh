#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 9: Starting Supabase Services"

cd "$DOCKER_PATH"

subsection "Disabling Supavisor"
if grep -q "^  supavisor:" docker-compose.yml 2>/dev/null; then
    cp docker-compose.yml docker-compose.yml.backup
    sed -i '/^  supavisor:/,/^  [a-z]/{ /^  supavisor:/s/^/#/; /^  [a-z]/!s/^/#/ }' docker-compose.yml
    success "Supavisor disabled"
fi

subsection "Starting All Services"
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
