#!/bin/bash

# Script to analyze migrations for potential conflicts
# This helps identify issues before running migrations

cd "$(dirname "$0")/supabase/migrations" || exit 1

echo "=== Migration Analysis Report ==="
echo ""

# Count total migrations
total=$(ls -1 *.sql 2>/dev/null | wc -l)
echo "Total migrations: $total"
echo ""

# Check for CREATE OR REPLACE FUNCTION that might conflict
echo "=== Checking for potential function parameter conflicts ==="
echo ""

# Get functions from prerequisite file
echo "Functions in prerequisite (with parameter names):"
grep "CREATE OR REPLACE FUNCTION" 00000000000000_initial_setup_prerequisites.sql | sed 's/CREATE OR REPLACE FUNCTION /  - /'
echo ""

# Check for same functions in other files with different signatures
echo "Checking other migrations for same function names..."
for func in "is_system_admin" "is_business_owner" "is_technical_support"; do
    echo ""
    echo "Function: $func"
    grep -l "CREATE.*FUNCTION.*$func" *.sql 2>/dev/null | while read file; do
        if [ "$file" != "00000000000000_initial_setup_prerequisites.sql" ]; then
            echo "  Found in: $file"
            grep "CREATE.*FUNCTION.*$func" "$file" | head -1 | sed 's/^/    /'
        fi
    done
done

echo ""
echo "=== Checking for duplicate table creations ==="
echo ""

# Check if base schema creates tables that other migrations also create
base_tables=$(grep "CREATE TABLE.*IF NOT EXISTS" 20251006010328_create_auditready_schema.sql 2>/dev/null | sed 's/.*IF NOT EXISTS //' | awk '{print $1}' | tr -d '(')
echo "Tables in base schema:"
echo "$base_tables" | sed 's/^/  - /'
echo ""

echo "Checking if other migrations try to create the same tables..."
echo "$base_tables" | while read table; do
    if [ -n "$table" ]; then
        files=$(grep -l "CREATE TABLE.*$table" *.sql 2>/dev/null | grep -v "20251006010328_create_auditready_schema.sql" | grep -v "00000000000000")
        if [ -n "$files" ]; then
            echo ""
            echo "Table '$table' also created in:"
            echo "$files" | sed 's/^/  - /'
        fi
    fi
done

echo ""
echo "=== Checking for migrations that modify the same table columns ==="
echo ""

# Look for ALTER TABLE ADD COLUMN operations that might conflict
echo "Looking for column additions that might conflict..."
for table in "receipts" "businesses" "profiles" "expense_categories"; do
    echo ""
    echo "Table: $table"
    grep -h "ALTER TABLE $table ADD COLUMN" *.sql 2>/dev/null | sort -u | sed 's/^/  /'
done

echo ""
echo "=== Checking for policy conflicts ==="
echo ""

# Check for policies with the same name
echo "Looking for duplicate policy names..."
grep -h "CREATE POLICY" *.sql 2>/dev/null | sed 's/.*CREATE POLICY "//' | sed 's/".*//' | sort | uniq -c | sort -rn | head -20 | awk '$1 > 1 {print "  " $0}'

echo ""
echo "=== Analysis complete ==="
echo ""
echo "Recommendations:"
echo "1. Functions with parameter conflicts should use DROP FUNCTION before CREATE"
echo "2. Duplicate table creations should use IF NOT EXISTS"
echo "3. Column additions should check IF NOT EXISTS"
echo "4. Policies should use DROP POLICY IF EXISTS before CREATE"
echo ""
