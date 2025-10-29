#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 10: Starting Frontend Container"

docker rm -f $FRONTEND_CONTAINER 2>/dev/null || true

docker run -d \
    --name $FRONTEND_CONTAINER \
    --network $DOCKER_NETWORK \
    -p $FRONTEND_PORT:80 \
    -v "$DIST_PATH:/usr/share/nginx/html:ro" \
    -v "$CONFIG_PATH/nginx.conf:/etc/nginx/nginx.conf:ro" \
    --restart unless-stopped \
    nginx:alpine

success "Frontend started on port $FRONTEND_PORT"
exit 0
