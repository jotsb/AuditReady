#!/bin/bash

##############################################################################
# Step 5: Generate and Update Encryption Key
##############################################################################

source "$(dirname "$0")/00-config.sh"

update_encryption_key() {
    log "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    log "${CYAN}║ Step 5: Generating New Encryption Key                     ║${NC}"
    log "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    # Generate 32-byte key as hex (64 characters)
    NEW_VAULT_KEY=$(openssl rand -hex 32)
    log "${YELLOW}New VAULT_ENC_KEY: ${NEW_VAULT_KEY:0:20}...${NEW_VAULT_KEY: -10}${NC}"
    log "${GREEN}✓ Generated 64-character hex key (32 bytes)${NC}"

    # Update .env file
    log "\n${YELLOW}Updating VAULT_ENC_KEY in .env file...${NC}"
    sed -i "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=$NEW_VAULT_KEY|" "$ENV_FILE"

    # Verify
    UPDATED_KEY=$(grep "^VAULT_ENC_KEY=" "$ENV_FILE" | cut -d= -f2)
    if [ "$UPDATED_KEY" == "$NEW_VAULT_KEY" ]; then
        log "${GREEN}✓ .env file updated successfully${NC}"
        return 0
    else
        log "${RED}✗ Failed to update .env file${NC}"
        return 1
    fi
}

# Run function when script is executed
update_encryption_key
