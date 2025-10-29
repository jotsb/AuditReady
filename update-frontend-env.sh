#!/bin/bash

##############################################################################
# Frontend .env Configuration Update Script
#
# This script updates your frontend .env.production file with the correct
# configuration for your Audit Proof self-hosted installation.
#
# Your Configuration:
# - Domain: test.auditproof.ca
#
# Usage:
#   1. Run the Supabase .env update script first!
#   2. Copy this script to your Unraid server
#   3. Make it executable: chmod +x update-frontend-env.sh
#   4. Run it: ./update-frontend-env.sh
#
##############################################################################

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/mnt/user/appdata/auditproof/project/AuditReady"
ENV_FILE="${PROJECT_DIR}/.env.production"
SECRETS_FILE="/mnt/user/appdata/auditproof/config/secrets.txt"
DIST_DIR="/mnt/user/appdata/auditproof/dist"

# Your specific configuration
DOMAIN="test.auditproof.ca"
SUPABASE_URL="https://${DOMAIN}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Frontend .env Update Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

##############################################################################
# Step 1: Validate environment
##############################################################################

echo -e "${YELLOW}Step 1: Validating environment...${NC}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}ERROR: Project directory not found at: $PROJECT_DIR${NC}"
    echo "Please ensure the project is cloned to the correct location."
    exit 1
fi

if [ ! -f "$SECRETS_FILE" ]; then
    echo -e "${RED}ERROR: Secrets file not found at: $SECRETS_FILE${NC}"
    echo "Please ensure Supabase is configured and secrets.txt exists."
    exit 1
fi

echo -e "${GREEN}✓ Project directory found${NC}"
echo -e "${GREEN}✓ Secrets file found${NC}"

##############################################################################
# Step 2: Read ANON_KEY from secrets.txt
##############################################################################

echo -e "\n${YELLOW}Step 2: Reading ANON_KEY...${NC}"

ANON_KEY=$(grep "^ANON_KEY=" "$SECRETS_FILE" | cut -d'=' -f2)

if [ -z "$ANON_KEY" ]; then
    echo -e "${RED}ERROR: ANON_KEY not found in secrets.txt${NC}"
    echo "Please ensure Supabase is properly configured."
    exit 1
fi

echo -e "${GREEN}✓ ANON_KEY retrieved${NC}"

##############################################################################
# Step 3: Create/Update .env.production
##############################################################################

echo -e "\n${YELLOW}Step 3: Creating .env.production file...${NC}"

if [ -f "$ENV_FILE" ]; then
    BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$ENV_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
fi

cat > "$ENV_FILE" << EOF
# Audit Proof Frontend Configuration
# Generated: $(date)

# ✅ IMPORTANT: Use your domain URL, NOT the internal IP
# This prevents Content Security Policy (CSP) violations
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${ANON_KEY}

# Why use the domain URL instead of http://192.168.1.246:8000?
# 1. Matches Content Security Policy (CSP) - allows 'self' origin
# 2. Uses HTTPS consistently (no mixed content warnings)
# 3. All requests go through SWAG proxy (single entry point)
# 4. Works correctly when accessed from external networks
EOF

echo -e "${GREEN}✓ .env.production created/updated${NC}"

##############################################################################
# Step 4: Check for Node.js
##############################################################################

echo -e "\n${YELLOW}Step 4: Checking for Node.js...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not found${NC}"
    echo ""
    echo "Please install Node.js first. Options:"
    echo "1. Via Unraid Apps: Search for 'Node.js' by ich777"
    echo "2. Manual install: https://nodejs.org/en/download/"
    echo ""
    echo "After installing, run this script again."
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo -e "${GREEN}✓ Node.js: ${NODE_VERSION}${NC}"
echo -e "${GREEN}✓ npm: ${NPM_VERSION}${NC}"

##############################################################################
# Step 5: Install dependencies (if needed)
##############################################################################

echo -e "\n${YELLOW}Step 5: Checking dependencies...${NC}"

cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies (this may take a few minutes)...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

##############################################################################
# Step 6: Build frontend
##############################################################################

echo -e "\n${YELLOW}Step 6: Building frontend...${NC}"
echo "This may take 1-2 minutes..."
echo ""

if npm run build; then
    echo -e "\n${GREEN}✓ Frontend built successfully${NC}"
else
    echo -e "\n${RED}ERROR: Build failed${NC}"
    echo "Please check the error messages above and fix any issues."
    exit 1
fi

##############################################################################
# Step 7: Deploy to dist directory
##############################################################################

echo -e "\n${YELLOW}Step 7: Deploying to production directory...${NC}"

# Create dist directory if it doesn't exist
mkdir -p "$DIST_DIR"

# Clear old files
echo "Clearing old files..."
rm -rf "${DIST_DIR:?}"/*

# Copy new build
echo "Copying new build..."
cp -r dist/* "$DIST_DIR/"

echo -e "${GREEN}✓ Frontend deployed to: $DIST_DIR${NC}"

##############################################################################
# Step 8: Verify deployment
##############################################################################

echo -e "\n${YELLOW}Step 8: Verifying deployment...${NC}"

# Check if index.html exists
if [ -f "${DIST_DIR}/index.html" ]; then
    echo -e "${GREEN}✓ index.html found${NC}"
else
    echo -e "${RED}ERROR: index.html not found in dist directory${NC}"
    exit 1
fi

# Check if the domain URL is in the built files
if grep -r "$SUPABASE_URL" "${DIST_DIR}/assets/"*.js &> /dev/null; then
    echo -e "${GREEN}✓ Domain URL found in built files${NC}"
else
    echo -e "${YELLOW}⚠ Warning: Domain URL not found in built files${NC}"
    echo "This might cause CSP errors. Check your .env.production file."
fi

##############################################################################
# Step 9: Restart frontend container
##############################################################################

echo -e "\n${YELLOW}Step 9: Restarting frontend container...${NC}"

read -p "Would you like to restart the frontend container now? (y/N): " RESTART_NOW

if [[ "$RESTART_NOW" =~ ^[Yy]$ ]]; then
    if docker ps | grep -q "auditproof-frontend"; then
        echo "Restarting auditproof-frontend..."
        docker restart auditproof-frontend
        echo -e "${GREEN}✓ Frontend container restarted${NC}"
    else
        echo -e "${YELLOW}⚠ Frontend container not found${NC}"
        echo "Please start the container manually from Unraid Docker UI."
    fi
else
    echo -e "${YELLOW}⚠ Remember to restart the frontend container manually!${NC}"
fi

##############################################################################
# Step 10: Display summary
##############################################################################

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Configuration Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Supabase URL:${NC} ${SUPABASE_URL}"
echo -e "${GREEN}✓ ANON_KEY:${NC} ${ANON_KEY:0:20}..."
echo -e "${GREEN}✓ Build Location:${NC} ${PROJECT_DIR}/dist"
echo -e "${GREEN}✓ Deployed To:${NC} ${DIST_DIR}"
echo ""

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Next Steps${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "1. Clear your browser cache:"
echo "   - Windows/Linux: Ctrl + Shift + R"
echo "   - Mac: Cmd + Shift + R"
echo ""
echo "2. Open your application:"
echo -e "   ${BLUE}${SUPABASE_URL}${NC}"
echo ""
echo "3. Verify no CSP errors:"
echo "   - Press F12 to open DevTools"
echo "   - Check Console tab for errors"
echo "   - Try to register a new user"
echo ""
echo "4. In Network tab (F12), verify API calls go to:"
echo -e "   ${GREEN}${SUPABASE_URL}/auth/v1/...${NC}"
echo "   (NOT http://192.168.1.246:8000/...)"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Frontend Update Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
