#!/bin/bash

# SMTP Configuration Script for Unraid/Self-Hosted Supabase
# This script helps configure SMTP environment variables for edge functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=============================================="
echo "AuditProof SMTP Configuration Setup"
echo "=============================================="
echo ""

# Function to read input with default value
read_with_default() {
    local prompt="$1"
    local default="$2"
    local value

    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        echo "${value:-$default}"
    else
        read -p "$prompt: " value
        echo "$value"
    fi
}

# Ask for SMTP configuration
echo -e "${BLUE}Enter your SMTP configuration:${NC}"
echo ""

SMTP_HOST=$(read_with_default "SMTP Host (e.g., smtp.gmail.com)" "smtp.gmail.com")
SMTP_PORT=$(read_with_default "SMTP Port" "465")
SMTP_USER=$(read_with_default "SMTP Username/Email" "")
SMTP_PASSWORD=$(read_with_default "SMTP Password" "")

echo ""
echo -e "${YELLOW}Configuration Summary:${NC}"
echo "  SMTP_HOST: $SMTP_HOST"
echo "  SMTP_PORT: $SMTP_PORT"
echo "  SMTP_USER: $SMTP_USER"
echo "  SMTP_PASSWORD: [HIDDEN]"
echo ""

read -p "Is this correct? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Configuration cancelled."
    exit 1
fi

# Create or update .env.functions file
ENV_FILE=".env.functions"
echo ""
echo "Creating $ENV_FILE..."

cat > "$ENV_FILE" << EOF
# SMTP Configuration for Edge Functions
# Generated: $(date)

SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASSWORD=$SMTP_PASSWORD

# Frontend URL (update if needed)
FRONTEND_URL=https://test.auditproof.ca
EOF

echo -e "${GREEN}✓ Created $ENV_FILE${NC}"
echo ""

# Create docker-compose snippet
COMPOSE_SNIPPET="docker-compose-smtp-snippet.yml"
echo "Creating docker-compose snippet..."

cat > "$COMPOSE_SNIPPET" << EOF
# Add these environment variables to your edge functions service
# in your docker-compose.yml file:

services:
  functions:
    environment:
      - SMTP_HOST=$SMTP_HOST
      - SMTP_PORT=$SMTP_PORT
      - SMTP_USER=$SMTP_USER
      - SMTP_PASSWORD=$SMTP_PASSWORD
      - FRONTEND_URL=https://test.auditproof.ca
      # ... your other environment variables
EOF

echo -e "${GREEN}✓ Created $COMPOSE_SNIPPET${NC}"
echo ""

# Instructions
echo "=============================================="
echo -e "${GREEN}Configuration files created!${NC}"
echo "=============================================="
echo ""
echo "Next steps to apply this configuration:"
echo ""
echo "1. Copy the environment variables to your Supabase container:"
echo ""
echo "   ${YELLOW}Option A: Using docker-compose${NC}"
echo "   - Open your docker-compose.yml file"
echo "   - Add the variables from $COMPOSE_SNIPPET to the 'functions' service"
echo "   - Run: docker-compose restart functions"
echo ""
echo "   ${YELLOW}Option B: Using docker run${NC}"
echo "   - Stop your edge functions container"
echo "   - Add these flags to your docker run command:"
echo "     -e SMTP_HOST=$SMTP_HOST \\"
echo "     -e SMTP_PORT=$SMTP_PORT \\"
echo "     -e SMTP_USER=$SMTP_USER \\"
echo "     -e SMTP_PASSWORD=$SMTP_PASSWORD \\"
echo "     -e FRONTEND_URL=https://test.auditproof.ca"
echo "   - Restart the container"
echo ""
echo "   ${YELLOW}Option C: Using Unraid Docker Template${NC}"
echo "   - Go to Docker tab in Unraid"
echo "   - Click on your Supabase edge-runtime container"
echo "   - Add these environment variables in the template"
echo "   - Apply and restart the container"
echo ""
echo "2. Verify the configuration:"
echo "   ./scripts/verify-smtp-config.sh"
echo ""
echo "3. Test sending an invitation from the Team page"
echo ""
echo "=============================================="
echo ""
echo -e "${YELLOW}IMPORTANT NOTES:${NC}"
echo ""
echo "• For Gmail, you MUST use an App Password, not your regular password"
echo "  Create one at: https://myaccount.google.com/apppasswords"
echo ""
echo "• Make sure port $SMTP_PORT is not blocked by your firewall"
echo ""
echo "• These credentials are stored in $ENV_FILE"
echo "  Keep this file secure and do not commit it to version control"
echo ""
echo "=============================================="
