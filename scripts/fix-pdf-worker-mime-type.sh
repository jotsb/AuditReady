#!/bin/bash

##############################################################################
# Fix PDF.js Worker MIME Type Issue
#
# Problem: PDF upload fails with error:
#   "Failed to load module script: Expected a JavaScript-or-Wasm module script
#   but the server responded with a MIME type of 'application/octet-stream'"
#
# Cause: Nginx is not serving .mjs files with the correct MIME type
#
# Solution: Add .mjs MIME type mapping to nginx.conf
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NGINX_CONTAINER="auditproof-nginx"
NGINX_CONF_PATH="/mnt/user/auditproof/config/nginx.conf"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Fix PDF.js Worker MIME Type${NC}"
echo -e "${BLUE}================================${NC}\n"

# Check if nginx container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${NGINX_CONTAINER}$"; then
    echo -e "${RED}Error: Nginx container '${NGINX_CONTAINER}' not found${NC}"
    echo -e "${YELLOW}Available containers:${NC}"
    docker ps -a --format '{{.Names}}'
    exit 1
fi

# Backup existing nginx.conf
echo -e "${YELLOW}Creating backup...${NC}"
BACKUP_FILE="${NGINX_CONF_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONF_PATH" "$BACKUP_FILE"
echo -e "${GREEN}Backup created: ${BACKUP_FILE}${NC}\n"

# Create new nginx.conf with .mjs MIME type
echo -e "${YELLOW}Updating nginx.conf...${NC}"
cat > "$NGINX_CONF_PATH" << 'NGINXEOF'
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # CRITICAL: Add .mjs MIME type for PDF.js worker
    types {
        application/javascript mjs;
        text/javascript js mjs;
    }

    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/javascript text/xml application/xml;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://test.auditproof.ca wss://test.auditproof.ca https://api.openai.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';" always;

        location / {
            try_files $uri $uri/ /index.html;
        }
        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINXEOF

echo -e "${GREEN}nginx.conf updated successfully${NC}\n"

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
if docker exec "$NGINX_CONTAINER" nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo -e "${GREEN}Configuration is valid${NC}\n"
else
    echo -e "${RED}Configuration test failed!${NC}"
    echo -e "${YELLOW}Restoring backup...${NC}"
    cp "$BACKUP_FILE" "$NGINX_CONF_PATH"
    echo -e "${GREEN}Backup restored${NC}"
    exit 1
fi

# Reload nginx
echo -e "${YELLOW}Reloading nginx...${NC}"
docker exec "$NGINX_CONTAINER" nginx -s reload

echo -e "${GREEN}Nginx reloaded successfully${NC}\n"

# Verify the fix
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Verification${NC}"
echo -e "${BLUE}================================${NC}\n"

echo -e "${GREEN}The fix has been applied!${NC}"
echo -e "\n${YELLOW}Test PDF upload:${NC}"
echo "1. Go to https://test.auditproof.ca/receipts"
echo "2. Click Upload"
echo "3. Select a scanned PDF file"
echo "4. It should now work without MIME type errors"
echo ""
echo -e "${YELLOW}If you still see issues, check:${NC}"
echo "- Clear browser cache (Ctrl+Shift+Delete)"
echo "- Hard refresh the page (Ctrl+Shift+R)"
echo "- Check browser console for any remaining errors"
echo ""
echo -e "${GREEN}Backup saved at: ${BACKUP_FILE}${NC}"
