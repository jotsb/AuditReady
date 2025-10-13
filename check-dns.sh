#!/bin/sh

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
SPF=$(dig +short TXT $DOMAIN | grep "v=spf1")
if test -z "$SPF"; then
    echo "SPF record NOT FOUND"
    echo "   Add this TXT record: v=spf1 include:_spf.privateemail.com ~all"
else
    echo "SPF record found:"
    echo "   $SPF"
    case "$SPF" in
        *privateemail*)
            echo "   Contains PrivateEmail authorization"
            ;;
        *)
            echo "   Does NOT contain PrivateEmail authorization"
            echo "   Should include: include:_spf.privateemail.com"
            ;;
    esac
fi
echo ""

# Check DKIM
echo "Checking DKIM Record..."
DKIM=$(dig +short TXT ${DKIM_SELECTOR}._domainkey.$DOMAIN)
if test -z "$DKIM"; then
    echo "DKIM record NOT FOUND"
    echo "   Expected at: ${DKIM_SELECTOR}._domainkey.$DOMAIN"
    echo "   Contact PrivateEmail to get your DKIM public key"
else
    echo "DKIM record found:"
    echo "   $DKIM" | fold -w 80
fi
echo ""

# Check DMARC
echo "Checking DMARC Record..."
DMARC=$(dig +short TXT _dmarc.$DOMAIN)
if test -z "$DMARC"; then
    echo "DMARC record NOT FOUND"
    echo "   Add this TXT record at _dmarc.$DOMAIN:"
    echo "   v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN"
else
    echo "DMARC record found:"
    echo "   $DMARC"
    case "$DMARC" in
        *"p=reject"*)
            echo "   Policy: REJECT (strict)"
            ;;
        *"p=quarantine"*)
            echo "   Policy: QUARANTINE (recommended)"
            ;;
        *"p=none"*)
            echo "   Policy: NONE (monitoring only)"
            ;;
    esac
fi
echo ""

# Check MX
echo "Checking MX Records..."
MX=$(dig +short MX $DOMAIN)
if test -z "$MX"; then
    echo "MX records NOT FOUND"
else
    echo "MX records found:"
    echo "$MX" | while read line; do
        echo "   $line"
    done
    case "$MX" in
        *privateemail*)
            echo "   Points to PrivateEmail"
            ;;
    esac
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="

ISSUES=0

test -z "$SPF" && ISSUES=$((ISSUES + 1))
test -z "$DKIM" && ISSUES=$((ISSUES + 1))
test -z "$DMARC" && ISSUES=$((ISSUES + 1))
test -z "$MX" && ISSUES=$((ISSUES + 1))

if test $ISSUES -eq 0; then
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
