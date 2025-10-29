#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-config.sh"

section "Step 7: Copying Edge Functions"
if [ -d "$PROJECT_FUNCTIONS" ]; then
    rm -rf "$FUNCTIONS_PATH"/*
    cp -r "$PROJECT_FUNCTIONS"/* "$FUNCTIONS_PATH/"
    success "Copied functions to $FUNCTIONS_PATH"
else
    warning "No functions found at $PROJECT_FUNCTIONS"
fi
exit 0
