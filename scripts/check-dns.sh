#!/bin/bash

# DNS Email Configuration Checker for auditproof.ca
# This script checks SPF, DKIM, DMARC, and MX records

DOMAIN="auditproof.ca"
DKIM_SELECTOR="default"

echo "=========================================="
echo "Email DNS Configuration Check"
echo "Domain: $DOMAIN"
echo "=========================================="
echo ""

# Check SPF
echo "Checking SPF Record..."
SPF=$(nslookup -type=TXT "$DOMAIN" 2>/dev/null | grep "v=spf1" | sed 's/"//g')
if [ -z "$SPF" ]; then
    echo "SPF record NOT FOUND"
    echo "   Add this TXT record: v=spf1 include:_spf.privateemail.com ~all"
else
    echo "SPF record found:"
    echo "   $SPF"
    if echo "$SPF" | grep -q "privateemail"; then
        echo "   Contains PrivateEmail authorization"
    else
        echo "   Does NOT contain PrivateEmail authorization"
        echo "   Should include: include:_spf.privateemail.com"
    fi
fi
echo ""

# Check DKIM
echo "Checking DKIM Record..."
DKIM=$(nslookup -type=TXT "${DKIM_SELECTOR}._domainkey.$DOMAIN" 2>/dev/null | grep "v=DKIM1" | sed 's/"//g')
if [ -z "$DKIM" ]; then
    echo "DKIM record NOT FOUND"
    echo "   Expected at: ${DKIM_SELECTOR}._domainkey.$DOMAIN"
    echo "   Contact PrivateEmail to get your DKIM public key"
else
    echo "DKIM record found:"
    echo "   $DKIM" | head -c 100
    echo "..."
fi
echo ""

# Check DMARC
echo "Checking DMARC Record..."
DMARC=$(nslookup -type=TXT "_dmarc.$DOMAIN" 2>/dev/null | grep "v=DMARC1" | sed 's/"//g')
if [ -z "$DMARC" ]; then
    echo "DMARC record NOT FOUND"
    echo "   Add this TXT record at _dmarc.$DOMAIN:"
    echo "   v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN"
else
    echo "DMARC record found:"
    echo "   $DMARC"
    if echo "$DMARC" | grep -q "p=reject"; then
        echo "   Policy: REJECT (strict)"
    elif echo "$DMARC" | grep -q "p=quarantine"; then
        echo "   Policy: QUARANTINE (recommended)"
    elif echo "$DMARC" | grep -q "p=none"; then
        echo "   Policy: NONE (monitoring only)"
    fi
fi
echo ""

# Check MX
echo "Checking MX Records..."
MX=$(nslookup -type=MX "$DOMAIN" 2>/dev/null | grep "mail exchanger" | awk '{print $4, $5, $6}')
if [ -z "$MX" ]; then
    echo "MX records NOT FOUND"
else
    echo "MX records found:"
    echo "$MX" | while read line; do
        echo "   $line"
    done
    if echo "$MX" | grep -q "privateemail"; then
        echo "   Points to PrivateEmail"
    fi
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="

ISSUES=0

[ -z "$SPF" ] && ISSUES=$((ISSUES + 1))
[ -z "$DKIM" ] && ISSUES=$((ISSUES + 1))
[ -z "$DMARC" ] && ISSUES=$((ISSUES + 1))
[ -z "$MX" ] && ISSUES=$((ISSUES + 1))

if [ $ISSUES -eq 0 ]; then
    echo "All DNS records are configured!"
    echo ""
    echo "Next steps:"
    echo "1. Test email sending from your application"
    echo "2. Check spam score at https://www.mail-tester.com/"
    echo "3. Monitor DMARC reports at dmarc@$DOMAIN"
else
    echo "Found $ISSUES missing or incomplete records"
    echo ""
    echo "Please configure the missing DNS records in Cloudflare"
    echo "See EMAIL_DELIVERABILITY_GUIDE.md for detailed instructions"
fi

echo ""
echo "Online verification tools:"
echo "- https://mxtoolbox.com/SuperTool.aspx?action=mx:$DOMAIN"
echo "- https://toolbox.googleapps.com/apps/checkmx/"
echo "- https://www.mail-tester.com/"
echo ""
