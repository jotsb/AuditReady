#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 5: Building Frontend"
cd "$PROJECT_PATH"
npm install && npm run build
rm -rf "$DIST_PATH"/*
cp -r "$PROJECT_DIST"/* "$DIST_PATH/"
success "Frontend built and copied to $DIST_PATH"
exit 0
