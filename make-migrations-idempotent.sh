#!/bin/bash

# This script makes all migrations idempotent by adding proper guards
# Run this before running migrations to prevent conflicts

cd "$(dirname "$0")/supabase/migrations" || exit 1

echo "=== Making Migrations Idempotent ==="
echo ""

# Function to add IF NOT EXISTS guards to ALTER TABLE ADD COLUMN
fix_alter_table_add_column() {
    local file=$1
    echo "Fixing ALTER TABLE ADD COLUMN in $file..."

    # Create a backup
    cp "$file" "$file.backup"

    # Use Perl for more complex regex replacements
    perl -i -pe 's/ALTER TABLE (\w+) ADD COLUMN (\w+)/ALTER TABLE $1 ADD COLUMN IF NOT EXISTS $2/g' "$file"

    echo "  ✓ Done"
}

# Function to add DROP POLICY IF EXISTS before CREATE POLICY
fix_create_policy() {
    local file=$1
    echo "Fixing CREATE POLICY in $file..."

    # This is complex and would need manual review
    # For now, just report
    policy_count=$(grep -c "CREATE POLICY" "$file" 2>/dev/null || echo "0")
    drop_count=$(grep -c "DROP POLICY IF EXISTS" "$file" 2>/dev/null || echo "0")

    if [ "$policy_count" -gt "$drop_count" ]; then
        echo "  ⚠ File has $policy_count CREATE POLICY but only $drop_count DROP POLICY IF EXISTS"
        echo "  Manual review recommended"
    fi
}

# Process all migration files
for file in *.sql; do
    if [ "$file" == "00000000000000_initial_setup_prerequisites.sql" ]; then
        echo "Skipping prerequisite file"
        continue
    fi

    # Check if file has ALTER TABLE ADD COLUMN without IF NOT EXISTS
    if grep -q "ALTER TABLE.*ADD COLUMN [^I]" "$file" 2>/dev/null; then
        fix_alter_table_add_column "$file"
    fi

    # Check policies
    if grep -q "CREATE POLICY" "$file" 2>/dev/null; then
        fix_create_policy "$file"
    fi
done

echo ""
echo "=== Fix Complete ==="
echo ""
echo "Note: Backups created with .backup extension"
echo "Review changes before running migrations"
