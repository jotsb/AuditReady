#!/bin/bash

##############################################################################
# Supabase .env Configuration Update Script
#
# This script updates your Supabase .env file with production-ready values
# for your Audit Proof self-hosted installation.
#
# Your Configuration:
# - Unraid IP: 192.168.1.246
# - Domain: test.auditproof.ca
# - SWAG IP: 192.168.1.65
#
# Usage:
#   1. Copy this script to your Unraid server
#   2. Make it executable: chmod +x update-supabase-env.sh
#   3. Run it: ./update-supabase-env.sh
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
ENV_FILE="/mnt/user/appdata/auditproof/supabase-project/.env"
BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# Your specific configuration
DOMAIN="test.auditproof.ca"
SITE_URL="https://${DOMAIN}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Audit Proof Supabase .env Update Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

##############################################################################
# Step 1: Validate environment
##############################################################################

echo -e "${YELLOW}Step 1: Validating environment...${NC}"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}ERROR: .env file not found at: $ENV_FILE${NC}"
    echo "Please ensure Supabase is installed at the correct location."
    exit 1
fi

echo -e "${GREEN}✓ Found .env file${NC}"

##############################################################################
# Step 2: Backup existing .env file
##############################################################################

echo -e "\n${YELLOW}Step 2: Creating backup...${NC}"
cp "$ENV_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"

##############################################################################
# Step 3: Prompt for SMTP credentials
##############################################################################

echo -e "\n${YELLOW}Step 3: SMTP Configuration${NC}"
echo "Please enter your PrivateEmail SMTP credentials."
echo "(Press Enter to skip and keep existing values)"
echo ""

read -p "SMTP Email (default: contact@auditproof.ca): " SMTP_EMAIL
SMTP_EMAIL=${SMTP_EMAIL:-contact@auditproof.ca}

read -sp "SMTP Password (required): " SMTP_PASSWORD
echo ""

if [ -z "$SMTP_PASSWORD" ]; then
    echo -e "${YELLOW}⚠ No SMTP password provided. Email features will not work.${NC}"
    echo "You can update this later by editing the .env file manually."
    SMTP_PASSWORD="YOUR_ACTUAL_EMAIL_PASSWORD_HERE"
fi

##############################################################################
# Step 4: Generate encryption keys if needed
##############################################################################

echo -e "\n${YELLOW}Step 4: Checking encryption keys...${NC}"

# Check if current keys are placeholders
CURRENT_VAULT_KEY=$(grep "^VAULT_ENC_KEY=" "$ENV_FILE" | cut -d'=' -f2)
CURRENT_PG_META_KEY=$(grep "^PG_META_CRYPTO_KEY=" "$ENV_FILE" | cut -d'=' -f2)

GENERATE_NEW_KEYS=false

if [[ "$CURRENT_VAULT_KEY" == *"your-encryption-key"* ]] || [ -z "$CURRENT_VAULT_KEY" ]; then
    echo -e "${YELLOW}⚠ Placeholder VAULT_ENC_KEY detected${NC}"
    GENERATE_NEW_KEYS=true
fi

if [[ "$CURRENT_PG_META_KEY" == *"your-encryption-key"* ]] || [ -z "$CURRENT_PG_META_KEY" ]; then
    echo -e "${YELLOW}⚠ Placeholder PG_META_CRYPTO_KEY detected${NC}"
    GENERATE_NEW_KEYS=true
fi

if [ "$GENERATE_NEW_KEYS" = true ]; then
    echo -e "${BLUE}Generating new encryption keys...${NC}"
    # Generate keys without padding (= characters) for Supavisor compatibility
    NEW_VAULT_KEY=$(openssl rand -base64 32 | tr -d '=')
    NEW_PG_META_KEY=$(openssl rand -base64 32 | tr -d '=')
    echo -e "${GREEN}✓ Generated new encryption keys (without padding)${NC}"
else
    echo -e "${GREEN}✓ Encryption keys already set, keeping existing values${NC}"
    NEW_VAULT_KEY="$CURRENT_VAULT_KEY"
    NEW_PG_META_KEY="$CURRENT_PG_META_KEY"
fi

##############################################################################
# Step 5: Update .env file
##############################################################################

echo -e "\n${YELLOW}Step 5: Updating .env file...${NC}"

# Create a temporary file for the updated config
TEMP_FILE=$(mktemp)

# Read the original file and make replacements
while IFS= read -r line; do
    # Skip empty lines and comments (but keep section headers)
    if [[ -z "$line" ]]; then
        echo "$line" >> "$TEMP_FILE"
        continue
    fi

    # Site URLs
    if [[ "$line" == SITE_URL=* ]]; then
        echo "SITE_URL=${SITE_URL}" >> "$TEMP_FILE"
    elif [[ "$line" == API_EXTERNAL_URL=* ]]; then
        echo "API_EXTERNAL_URL=${SITE_URL}" >> "$TEMP_FILE"
    elif [[ "$line" == SUPABASE_PUBLIC_URL=* ]]; then
        echo "SUPABASE_PUBLIC_URL=${SITE_URL}" >> "$TEMP_FILE"

    # SMTP Settings
    elif [[ "$line" == SMTP_ADMIN_EMAIL=* ]]; then
        echo "SMTP_ADMIN_EMAIL=${SMTP_EMAIL}" >> "$TEMP_FILE"
    elif [[ "$line" == SMTP_HOST=* ]]; then
        echo "SMTP_HOST=mail.privateemail.com" >> "$TEMP_FILE"
    elif [[ "$line" == SMTP_PORT=* ]]; then
        echo "SMTP_PORT=465" >> "$TEMP_FILE"
    elif [[ "$line" == SMTP_USER=* ]]; then
        echo "SMTP_USER=${SMTP_EMAIL}" >> "$TEMP_FILE"
    elif [[ "$line" == SMTP_PASS=* ]]; then
        echo "SMTP_PASS=${SMTP_PASSWORD}" >> "$TEMP_FILE"
    elif [[ "$line" == SMTP_SENDER_NAME=* ]]; then
        echo "SMTP_SENDER_NAME=Audit Proof" >> "$TEMP_FILE"

    # Email Configuration
    elif [[ "$line" == ENABLE_EMAIL_AUTOCONFIRM=* ]]; then
        echo "ENABLE_EMAIL_AUTOCONFIRM=true" >> "$TEMP_FILE"
    elif [[ "$line" == ENABLE_PHONE_SIGNUP=* ]]; then
        echo "ENABLE_PHONE_SIGNUP=false" >> "$TEMP_FILE"
    elif [[ "$line" == ENABLE_PHONE_AUTOCONFIRM=* ]]; then
        echo "ENABLE_PHONE_AUTOCONFIRM=false" >> "$TEMP_FILE"

    # Encryption Keys
    elif [[ "$line" == VAULT_ENC_KEY=* ]]; then
        echo "VAULT_ENC_KEY=${NEW_VAULT_KEY}" >> "$TEMP_FILE"
    elif [[ "$line" == PG_META_CRYPTO_KEY=* ]]; then
        echo "PG_META_CRYPTO_KEY=${NEW_PG_META_KEY}" >> "$TEMP_FILE"

    else
        echo "$line" >> "$TEMP_FILE"
    fi
done < "$ENV_FILE"

##############################################################################
# Step 6: Add missing configurations
##############################################################################

echo -e "${YELLOW}Step 6: Adding missing configurations...${NC}"

# Check if ADDITIONAL_REDIRECT_URLS exists
if ! grep -q "^ADDITIONAL_REDIRECT_URLS=" "$ENV_FILE"; then
    echo -e "${BLUE}Adding ADDITIONAL_REDIRECT_URLS...${NC}"
    # Insert after SITE_URL
    sed -i "/^SITE_URL=/a ADDITIONAL_REDIRECT_URLS=${SITE_URL}/**" "$TEMP_FILE"
fi

# Check if Edge Functions section exists
if ! grep -q "Edge Functions Environment Variables" "$TEMP_FILE"; then
    echo -e "${BLUE}Adding Edge Functions environment variables...${NC}"

    # Find the line number for "# Functions - Configuration for Functions"
    # We'll add the Edge Functions section after FUNCTIONS_VERIFY_JWT

    # Add the Edge Functions section before the Logs section
    cat >> "$TEMP_FILE" << 'EOF'

############
# Edge Functions Environment Variables
# These are needed for your Edge Functions to work
############

# Supabase connection for Edge Functions (internal Docker network)
SUPABASE_URL=http://kong:8000
SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# SMTP for Edge Functions (send-invitation-email function)
# Must match SMTP settings above
SMTP_FROM=${SMTP_ADMIN_EMAIL}
SMTP_PASSWORD=${SMTP_PASS}

EOF
fi

# Move the temporary file to replace the original
mv "$TEMP_FILE" "$ENV_FILE"

echo -e "${GREEN}✓ .env file updated successfully${NC}"

##############################################################################
# Step 7: Display summary
##############################################################################

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Configuration Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Site URL:${NC} ${SITE_URL}"
echo -e "${GREEN}✓ SMTP Host:${NC} mail.privateemail.com:465"
echo -e "${GREEN}✓ SMTP Email:${NC} ${SMTP_EMAIL}"
echo -e "${GREEN}✓ Email Auto-Confirm:${NC} Enabled (users can login immediately)"
echo -e "${GREEN}✓ Encryption Keys:${NC} Generated/Updated"
echo -e "${GREEN}✓ Edge Functions:${NC} Environment variables added"
echo ""
echo -e "${YELLOW}Backup saved to:${NC} $BACKUP_FILE"
echo ""

##############################################################################
# Step 8: Verify and prompt for restart
##############################################################################

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Next Steps${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "1. Review the updated .env file:"
echo -e "   ${BLUE}nano $ENV_FILE${NC}"
echo ""
echo "2. Restart Supabase services to apply changes:"
echo -e "   ${BLUE}cd /mnt/user/appdata/auditproof/supabase-src/docker${NC}"
echo -e "   ${BLUE}docker compose down${NC}"
echo -e "   ${BLUE}docker compose up -d${NC}"
echo ""
echo "3. Verify all services are healthy:"
echo -e "   ${BLUE}docker compose ps${NC}"
echo ""
echo "4. Update your frontend .env.production file:"
echo -e "   ${BLUE}cd /mnt/user/appdata/auditproof/project/AuditReady${NC}"
echo -e "   ${BLUE}nano .env.production${NC}"
echo ""
echo "   Add these lines:"
echo -e "   ${GREEN}VITE_SUPABASE_URL=${SITE_URL}${NC}"
echo -e "   ${GREEN}VITE_SUPABASE_ANON_KEY=<your_anon_key_from_secrets.txt>${NC}"
echo ""
echo "5. Rebuild and deploy frontend:"
echo -e "   ${BLUE}npm run build${NC}"
echo -e "   ${BLUE}cp -r dist/* /mnt/user/appdata/auditproof/dist/${NC}"
echo -e "   ${BLUE}docker restart auditproof-frontend${NC}"
echo ""

read -p "Would you like to restart Supabase services now? (y/N): " RESTART_NOW

if [[ "$RESTART_NOW" =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}Restarting Supabase services...${NC}"

    SUPABASE_DIR="/mnt/user/appdata/auditproof/supabase-src/docker"

    if [ ! -d "$SUPABASE_DIR" ]; then
        echo -e "${RED}ERROR: Supabase directory not found at: $SUPABASE_DIR${NC}"
        echo "Please restart services manually."
        exit 1
    fi

    cd "$SUPABASE_DIR"

    echo "Stopping services..."
    docker compose down

    echo "Starting services..."
    docker compose up -d

    echo -e "\n${YELLOW}Waiting 10 seconds for services to start...${NC}"
    sleep 10

    echo -e "\n${BLUE}Service Status:${NC}"
    docker compose ps

    echo -e "\n${GREEN}✓ Supabase services restarted${NC}"
else
    echo -e "\n${YELLOW}⚠ Remember to restart Supabase services manually!${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Configuration Update Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "If you need to restore the original .env file:"
echo -e "  ${BLUE}cp $BACKUP_FILE $ENV_FILE${NC}"
echo ""
