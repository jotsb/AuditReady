#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 6: Setting Up Nginx"
cat > "$CONFIG_PATH/nginx.conf" << 'NGINXEOF'
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

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
success "Nginx configured with CSP headers"
exit 0
