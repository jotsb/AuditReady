# SWAG Reverse Proxy Configuration for Audit Proof

This is the complete nginx configuration for routing traffic to your Audit Proof application.

## Configuration File

**Path:** `/mnt/user/appdata/swag/nginx/proxy-confs/auditproof.subdomain.conf`

## Complete Configuration

```nginx
# Audit Proof proxy configuration

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;

    server_name test.auditproof.ca auditproof.*;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name test.auditproof.ca auditproof.*;

    include /config/nginx/ssl.conf;

    client_max_body_size 50M;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to frontend
    location / {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8080;
    }

    # Proxy API requests to Kong Gateway
    location /functions/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;
    }

    location /auth/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;
    }

    location /rest/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;
    }

    location /storage/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;
        client_max_body_size 50M;
    }

    location /realtime/ {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=30s;
        proxy_pass http://192.168.1.246:8000;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

## Installation Steps

### 1. Create the Configuration File

```bash
# SSH into Unraid
ssh root@192.168.1.246

# Navigate to SWAG config directory
cd /mnt/user/appdata/swag/nginx/proxy-confs

# Create the configuration file
nano auditproof.subdomain.conf
```

### 2. Paste the Configuration

Copy the entire nginx configuration above and paste it into the file.

**Save and exit:** Ctrl+X, Y, Enter

### 3. Restart SWAG

```bash
docker restart swag-reverse-proxy
```

**Or via Unraid GUI:**
1. Go to **Docker** tab
2. Find **swag-reverse-proxy**
3. Click **Restart**

### 4. Configure DNS

In your DNS provider (Cloudflare, GoDaddy, etc.):

**Add A Record:**
- **Type:** A
- **Name:** `test`
- **Value:** Your public IP address
- **TTL:** Auto or 3600

**Wait 5-30 minutes** for DNS propagation.

### 5. Test Access

**Test HTTPS:**
```
https://test.auditproof.ca
```

**Test HTTP Redirect:**
```
http://test.auditproof.ca
```
(Should automatically redirect to HTTPS)

## What This Configuration Does

### HTTP to HTTPS Redirect
- All HTTP (port 80) requests are automatically redirected to HTTPS (port 443)
- Users typing `http://test.auditproof.ca` will be redirected to `https://test.auditproof.ca`

### HTTPS Handling
- Serves content over SSL/TLS (encrypted)
- Uses HTTP/2 for better performance
- Includes security headers (HSTS, X-Frame-Options, etc.)

### Routing

| Path | Proxies To | Purpose |
|------|-----------|---------|
| `/` | `http://192.168.1.246:8080` | Frontend (React app) |
| `/functions/` | `http://192.168.1.246:8000` | Supabase Edge Functions |
| `/auth/` | `http://192.168.1.246:8000` | Authentication API |
| `/rest/` | `http://192.168.1.246:8000` | Database REST API |
| `/storage/` | `http://192.168.1.246:8000` | File storage API |
| `/realtime/` | `http://192.168.1.246:8000` | WebSocket realtime |

## Security Features

### Headers Added
- **HSTS:** Forces HTTPS for 1 year
- **X-Frame-Options:** Prevents clickjacking
- **X-Content-Type-Options:** Prevents MIME sniffing
- **X-XSS-Protection:** XSS attack protection

### File Upload Limits
- Default: 50MB
- Storage endpoint: 50MB (for receipt images)

### WebSocket Support
- Long-lived connections for realtime features
- 24-hour timeout for realtime subscriptions

## Troubleshooting

### Site Not Loading

**Check SWAG logs:**
```bash
docker logs swag-reverse-proxy
```

**Check nginx config syntax:**
```bash
docker exec swag-reverse-proxy nginx -t
```

### SSL Certificate Issues

**Check if certificate was generated:**
```bash
docker exec swag-reverse-proxy ls -la /config/keys/letsencrypt/
```

**Regenerate certificate:**
```bash
docker restart swag-reverse-proxy
```

**Check SWAG environment:**
- Make sure `URL` env variable includes your domain
- Make sure `SUBDOMAINS` includes `test` or is set to `wildcard`

### Port Forwarding

Make sure your router forwards these ports to **192.168.1.65** (SWAG IP):
- **Port 80** (HTTP) → 192.168.1.65:80
- **Port 443** (HTTPS) → 192.168.1.65:443

### DNS Not Resolving

**Test DNS:**
```bash
nslookup test.auditproof.ca
# Should return your public IP
```

**Test local resolution:**
```bash
ping test.auditproof.ca
```

### Backend Not Responding

**Check Kong Gateway is running:**
```bash
docker ps | grep kong
# Should show kong-gateway container running
```

**Check frontend is running:**
```bash
docker ps | grep auditproof-frontend
# Should show auditproof-frontend container running
```

**Test backend directly:**
```bash
curl http://192.168.1.246:8000/health
# Should return health check response
```

## Environment Configuration

### SWAG Container Environment

Make sure your SWAG container has these environment variables:

```bash
URL=auditproof.ca
SUBDOMAINS=test,wildcard
VALIDATION=dns
DNSPLUGIN=cloudflare  # or your DNS provider
EMAIL=your-email@example.com
```

### DNS Plugin

If using Cloudflare (or another DNS provider), make sure you have:
1. API credentials configured
2. DNS plugin enabled in SWAG
3. Proper permissions for DNS validation

## Production Checklist

Before going live:
- [ ] DNS properly configured
- [ ] SSL certificate generated successfully
- [ ] HTTP redirects to HTTPS
- [ ] All API endpoints respond correctly
- [ ] WebSocket connections work
- [ ] File uploads work (test with receipt)
- [ ] Port forwarding configured
- [ ] SWAG logs show no errors
- [ ] Security headers present (check browser DevTools)

## Support

If you encounter issues:
1. Check SWAG logs: `docker logs swag-reverse-proxy`
2. Check nginx error log: `/mnt/user/appdata/swag/log/nginx/error.log`
3. Verify DNS with: `nslookup test.auditproof.ca`
4. Test backend: `curl http://192.168.1.246:8000/health`
5. Test frontend: `curl http://192.168.1.246:8080`
