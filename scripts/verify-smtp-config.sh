#!/bin/bash

# SMTP Configuration Verification Script for AuditProof
# This script helps verify that SMTP is properly configured in your Supabase edge functions

set -e

echo "=============================================="
echo "AuditProof SMTP Configuration Verifier"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "Loading .env file..."
    export $(grep -v '^#' .env | xargs)
fi

echo "Checking SMTP configuration..."
echo ""

# Check if required variables are set
MISSING_VARS=()

if [ -z "$SMTP_HOST" ]; then
    MISSING_VARS+=("SMTP_HOST")
fi

if [ -z "$SMTP_PORT" ]; then
    MISSING_VARS+=("SMTP_PORT")
fi

if [ -z "$SMTP_USER" ]; then
    MISSING_VARS+=("SMTP_USER")
fi

if [ -z "$SMTP_PASSWORD" ]; then
    MISSING_VARS+=("SMTP_PASSWORD")
fi

# Display results
if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All SMTP variables are configured:${NC}"
    echo "  SMTP_HOST: $SMTP_HOST"
    echo "  SMTP_PORT: $SMTP_PORT"
    echo "  SMTP_USER: $SMTP_USER"
    echo "  SMTP_PASSWORD: [HIDDEN]"
    echo ""
    echo -e "${GREEN}SMTP configuration is complete!${NC}"
else
    echo -e "${RED}✗ Missing SMTP variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo -e "${YELLOW}SMTP is NOT configured. Emails will not be sent.${NC}"
    echo ""
    echo "To fix this, add these variables to your docker-compose.yml or .env file:"
    echo ""
    echo "  SMTP_HOST=smtp.gmail.com"
    echo "  SMTP_PORT=465"
    echo "  SMTP_USER=your-email@gmail.com"
    echo "  SMTP_PASSWORD=your-app-password"
    echo ""
    exit 1
fi

# Test connection to SMTP server (if nc is available)
if command -v nc &> /dev/null; then
    echo ""
    echo "Testing connection to SMTP server..."
    if nc -z -w5 "$SMTP_HOST" "$SMTP_PORT" 2>/dev/null; then
        echo -e "${GREEN}✓ Successfully connected to $SMTP_HOST:$SMTP_PORT${NC}"
    else
        echo -e "${RED}✗ Cannot connect to $SMTP_HOST:$SMTP_PORT${NC}"
        echo "  This could be a firewall issue or incorrect SMTP_HOST/PORT"
    fi
fi

echo ""
echo "=============================================="
echo "Next steps:"
echo "1. Make sure these variables are set in your Supabase edge functions environment"
echo "2. Restart your edge functions container"
echo "3. Test sending an invitation from the Team page"
echo "=============================================="
