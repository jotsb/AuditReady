#!/bin/bash

# DNS Email Configuration Checker for auditproof.ca
# This script checks SPF, DKIM, DMARC, and MX records

DOMAIN="auditproof.ca"
DKIM_SELECTOR="default"  # Change this if PrivateEmail gives you a different selector

echo "=========================================="
echo "Email DNS Configuration Check"
echo "Domain: $DOMAIN"
echo "=========================================="
echo ""

# Check SPF
echo "🔍 Checking SPF Record..."
SPF=$(dig +short TXT $DOMAIN | grep "v=spf1")
if [ -z "$SPF" ]; then
    echo "❌ SPF record NOT FOUND"
    echo "   Add this TXT record: v=spf1 include:_spf.privateemail.com ~all"
else
    echo "✅ SPF record found:"
    echo "   $SPF"
    if [[ $SPF == *"privateemail"* ]]; then
        echo "   ✅ Contains PrivateEmail authorization"
    else
        echo "   ⚠️  Does NOT contain PrivateEmail authorization"
        echo "   Should include: include:_spf.privateemail.com"
    fi
fi
echo ""

# Check DKIM
echo "🔍 Checking DKIM Record..."
DKIM=$(dig +short TXT ${DKIM_SELECTOR}._domainkey.$DOMAIN)
if [ -z "$DKIM" ]; then
    echo "❌ DKIM record NOT FOUND"
    echo "   Expected at: ${DKIM_SELECTOR}._domainkey.$DOMAIN"
    echo "   Contact PrivateEmail to get your DKIM public key"
else
    echo "✅ DKIM record found:"
    echo "   $DKIM" | fold -w 80
fi
echo ""

# Check DMARC
echo "🔍 Checking DMARC Record..."
DMARC=$(dig +short TXT _dmarc.$DOMAIN)
if [ -z "$DMARC" ]; then
    echo "❌ DMARC record NOT FOUND"
    echo "   Add this TXT record at _dmarc.$DOMAIN:"
    echo "   v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN"
else
    echo "✅ DMARC record found:"
    echo "   $DMARC"
    if [[ $DMARC == *"p=reject"* ]]; then
        echo "   Policy: REJECT (strict)"
    elif [[ $DMARC == *"p=quarantine"* ]]; then
        echo "   Policy: QUARANTINE (recommended)"
    elif [[ $DMARC == *"p=none"* ]]; then
        echo "   ⚠️  Policy: NONE (monitoring only)"
    fi
fi
echo ""

# Check MX
echo "🔍 Checking MX Records..."
MX=$(dig +short MX $DOMAIN)
if [ -z "$MX" ]; then
    echo "❌ MX records NOT FOUND"
else
    echo "✅ MX records found:"
    echo "$MX" | while read line; do
        echo "   $line"
    done
    if [[ $MX == *"privateemail"* ]]; then
        echo "   ✅ Points to PrivateEmail"
    fi
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="

ISSUES=0

if [ -z "$SPF" ]; then ((ISSUES++)); fi
if [ -z "$DKIM" ]; then ((ISSUES++)); fi
if [ -z "$DMARC" ]; then ((ISSUES++)); fi
if [ -z "$MX" ]; then ((ISSUES++)); fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ All DNS records are configured!"
    echo ""
    echo "Next steps:"
    echo "1. Test email sending from your application"
    echo "2. Check spam score at https://www.mail-tester.com/"
    echo "3. Monitor DMARC reports at dmarc@$DOMAIN"
else
    echo "⚠️  Found $ISSUES missing or incomplete records"
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
