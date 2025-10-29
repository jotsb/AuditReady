#!/bin/bash
##############################################################################
# AuditProof Infrastructure Setup - Main Orchestrator
##############################################################################

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

clear
cat << 'BANNER'
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                     AUDITPROOF INFRASTRUCTURE SETUP                        ║
║                                                                            ║
║                        Complete System Installation                        ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
BANNER

echo ""
echo "This will set up:"
echo "  ✓ Frontend (React + Vite) with CSP headers"
echo "  ✓ Supabase backend (PostgreSQL, Auth, Storage, Functions)"
echo "  ✓ Database migrations"
echo "  ✓ Storage buckets (receipts)"
echo "  ✓ Edge functions"
echo "  ✓ Admin user account"
echo "  ✓ SMTP configuration"
echo "  ✓ Complete security setup"
echo ""
echo "Estimated time: 5-10 minutes"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Pre-flight checks
echo ""
echo "Running pre-flight checks..."
if ! docker ps >/dev/null 2>&1; then echo "ERROR: Docker not running"; exit 1; fi
if ! command -v node >/dev/null 2>&1; then echo "ERROR: Node.js not installed"; exit 1; fi
if ! command -v npm >/dev/null 2>&1; then echo "ERROR: npm not installed"; exit 1; fi
echo "✓ Pre-flight checks passed"
echo ""

run_step() {
    local num="$1" script="$2" name="$3"
    echo ""
    echo "════════════════════════════════════════════════════════════════════════"
    echo "STEP $num: $name"
    echo "════════════════════════════════════════════════════════════════════════"
    echo ""
    if bash "$SCRIPT_DIR/$script"; then
        echo "✓ Step $num completed"
        return 0
    else
        echo "✗ Step $num failed"
        return 1
    fi
}

# Execute all steps
run_step 1 "01-validate-paths.sh" "Validate Paths" || exit 1
run_step 2 "02-backup-all.sh" "Backup Configuration" || exit 1
run_step 3 "03-generate-secrets.sh" "Generate Secrets" || exit 1
run_step 4 "04-configure-env.sh" "Configure Environment" || exit 1
run_step 5 "05-build-frontend.sh" "Build Frontend" || exit 1
run_step 6 "06-setup-nginx.sh" "Setup Nginx" || exit 1
run_step 7 "07-copy-functions.sh" "Copy Edge Functions" || exit 1
run_step 8 "08-setup-database.sh" "Setup Database" || exit 1
run_step 9 "09-start-services.sh" "Start Services" || exit 1
run_step 10 "10-start-frontend.sh" "Start Frontend" || exit 1
run_step 11 "11-verify-all.sh" "Verify Installation" || true

# Final summary
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "                          SETUP COMPLETE"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "✓ All components installed and verified"
echo ""
echo "IMPORTANT: Verify SWAG configuration at:"
echo "  /mnt/user/appdata/swag/nginx/proxy-confs/auditproof.subdomain.conf"
echo ""
echo "Next steps:"
echo "  1. Update JWT tokens (see secrets.txt)"
echo "  2. Configure SMTP if needed"
echo "  3. Test at https://test.auditproof.ca"
echo "  4. Follow test workflow: workflows/TEST_WORKFLOW.md"
echo ""
echo "To reset: ./99-reset-infrastructure.sh"
echo ""
