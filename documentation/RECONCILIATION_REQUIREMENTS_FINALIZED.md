# Bank Reconciliation - Finalized Requirements

**Last Updated:** 2025-12-03
**Status:** Ready for Implementation

---

## ✅ Confirmed Requirements

Based on client feedback, here are the finalized specifications:

### 1. File Format Support

**Requirement:** Support all three formats
- ✅ PDF statements
- ✅ CSV exports
- ✅ Excel files (.xls, .xlsx)

**Implementation Priority:**
1. Phase 1: PDF (most common)
2. Phase 2: CSV (easy to parse)
3. Phase 3: Excel (requires additional library)

**Technical Notes:**
- PDF: Use pdfjs-dist (already installed)
- CSV: Use built-in parsing (no dependencies)
- Excel: Use SheetJS or similar (add in Phase 3)

---

### 2. Matching Tolerances

#### Date Tolerance: 30 Days
**Confidence Scoring:**
```
Days Apart     Confidence Weight    Scenario
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0-3 days       1.00 (100%)          Normal payment delay
4-7 days       0.90 (90%)           Standard processing
8-14 days      0.75 (75%)           Slow processing
15-21 days     0.60 (60%)           NET15 terms
22-30 days     0.40 (40%)           NET30 terms, requires review
```

**Configurable:** Yes, per business in Settings
- Default: 30 days
- Range: 7-60 days
- Business can adjust based on payment habits

**Examples Handled:**
- Invoice dated Sept 4, payment posted Sept 10 (6 days) ✅
- Amazon order Dec 5, charge Dec 7 (2 days) ✅
- Government invoice Nov 1, payment Nov 28 (27 days) ✅

#### Amount Tolerance: 20%
**Confidence Scoring:**
```
Amount Diff         Confidence Weight    Scenario
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exact match         1.00 (100%)          Perfect match
Within $5           0.90 (90%)           Small tip/fee
Within 10%          0.80 (80%)           Standard tip
Within 20%          0.60 (60%)           Large tip or partial
Over 20%            0.30 (30%)           Review required
```

**Special Cases:**
- Tips (15-20%): Handled automatically
- Partial payments: Flagged as "partial" match
- Tax differences: Within tolerance
- Foreign exchange: Calculate at transaction date rate

**Examples:**
- Receipt $50.00, Statement $60.00 (20% tip) = 60% confidence ✅
- Receipt $100.00, Statement $105.00 (5% diff) = 80% confidence ✅
- Receipt $1000.00, Statement $500.00 = Partial payment ✅

---

### 3. Multiple Businesses (Credit Card Shared)

**Scenario:** One credit card used for multiple businesses

**Solution:** Three-tier approach

#### Tier 1: Import with Business Context
```
When uploading statement, ask:
┌─────────────────────────────────────────────┐
│ Credit Card Statement Upload                │
├─────────────────────────────────────────────┤
│ This card may have transactions for         │
│ multiple businesses.                        │
│                                             │
│ Import to: [Current Business ▼]            │
│                                             │
│ ☑ Allow me to reassign transactions later  │
│ ☑ Learn merchant-to-business patterns      │
│                                             │
│ [Upload & Parse]                            │
└─────────────────────────────────────────────┘
```

#### Tier 2: Post-Import Reassignment
```
After import, show Business Assignment page:
┌─────────────────────────────────────────────┐
│ Assign Transactions to Businesses           │
├─────────────────────────────────────────────┤
│ ☐ Home Depot      $123.45   Sept 6         │
│   Assigned to: [Construction LLC ▼]        │
│   [Apply to all Home Depot transactions]   │
│                                             │
│ ☐ Staples         $45.20    Sept 8         │
│   Assigned to: [Office Services Inc ▼]     │
│   [Apply to all Staples transactions]      │
│                                             │
│ [Bulk Assign Selected] [Save All]          │
└─────────────────────────────────────────────┘
```

**Features:**
- Individual reassignment
- Bulk reassignment by merchant
- Create rule: "All Home Depot → Construction LLC"

#### Tier 3: Learning System
```sql
-- Store learned patterns
CREATE TABLE merchant_business_rules (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  merchant_pattern TEXT, -- 'Home Depot', 'HD%', etc.
  business_id UUID REFERENCES businesses(id),
  times_applied INTEGER DEFAULT 0,
  confidence DECIMAL(3,2) DEFAULT 0.50, -- Increases with confirmations
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**How it works:**
1. User assigns "Home Depot" to "Construction LLC" (3 times manually)
2. System creates rule: "Home Depot" → "Construction LLC" (confidence 70%)
3. Next import: System auto-assigns with suggestion
4. User confirms → Confidence increases to 85%
5. After 5 confirmations → Auto-assign with 95% confidence

**Manual Override:**
- User can always move transaction to different business
- System asks: "Always use this business for [Merchant]?"
- Rules visible in Settings → Reconciliation Rules

---

### 4. Bidirectional Matching (Historical + Forward)

**Requirement:** Match receipts and statements uploaded in any order

#### Scenario A: Receipt First, Statement Later
```
Day 1: User uploads Home Depot receipt
       - Stored as "Unmatched Receipt"
       - Status: "Waiting for payment record"

Day 30: User uploads CC statement (includes Home Depot transaction)
        - System scans ALL unmatched receipts
        - Finds match with 30-day-old receipt
        - Creates match with 85% confidence
        - Status: "Matched"
```

#### Scenario B: Statement First, Receipt Later
```
Day 1: User uploads CC statement
       - Transaction stored as "Unmatched Transaction"
       - Status: "Missing receipt"
       - Alert: "Upload receipt for this transaction"

Day 15: User uploads receipt
        - System scans ALL unmatched transactions
        - Finds match with 15-day-old transaction
        - Creates match with 90% confidence
        - Status: "Matched"
```

#### Scenario C: Suggested Matches (User Review)
```
When confidence is 60-85% (uncertain):

┌─────────────────────────────────────────────┐
│ Suggested Matches (5)                       │
├─────────────────────────────────────────────┤
│ Transaction: HOME DEPOT, Sept 6, $123.45    │
│ Receipt: Home Depot, Sept 4, $123.45       │
│ Confidence: 75%                             │
│ Reasons:                                    │
│ ✓ Exact amount match                       │
│ ✓ Merchant similar (0.92)                  │
│ ⚠ 2 days apart                             │
│                                             │
│ [✓ Approve] [✗ Reject] [Manual Match]      │
├─────────────────────────────────────────────┤
│ Viewing 1 of 5 [Previous] [Next]           │
└─────────────────────────────────────────────┘
```

**User Actions:**
- ✓ Approve: Confirm match (system learns)
- ✗ Reject: Not a match (system learns)
- Manual Match: Show all transactions/receipts, user drags to match

**Database Implementation:**
```sql
-- Always search both directions
CREATE OR REPLACE FUNCTION find_potential_matches(
  p_business_id UUID,
  p_date_tolerance_days INTEGER DEFAULT 30,
  p_amount_tolerance_pct DECIMAL DEFAULT 0.20
)
RETURNS TABLE (
  transaction_id UUID,
  receipt_id UUID,
  confidence_score DECIMAL,
  date_diff_days INTEGER,
  amount_diff_pct DECIMAL,
  merchant_similarity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id as transaction_id,
    r.id as receipt_id,
    calculate_match_confidence(st, r) as confidence_score,
    ABS(EXTRACT(DAY FROM st.transaction_date - r.transaction_date)) as date_diff_days,
    ABS((st.amount - r.total_amount) / r.total_amount) as amount_diff_pct,
    similarity(st.merchant_name, r.vendor_name) as merchant_similarity
  FROM statement_transactions st
  CROSS JOIN receipts r
  WHERE st.business_id = p_business_id
    AND r.business_id = p_business_id
    AND st.match_status = 'unmatched'
    AND (r.matched_transaction_id IS NULL OR r.matched_transaction_id = st.id)
    AND ABS(EXTRACT(DAY FROM st.transaction_date - r.transaction_date)) <= p_date_tolerance_days
    AND ABS((st.amount - r.total_amount) / NULLIF(r.total_amount, 0)) <= p_amount_tolerance_pct
  ORDER BY confidence_score DESC;
END;
$$ LANGUAGE plpgsql;
```

---

### 5. Partial Payments

**Requirement:** Handle both scenarios
1. One invoice, multiple payments
2. Multiple invoices, one payment

#### Implementation: Many-to-Many Matching

**Database Schema:**
```sql
CREATE TABLE transaction_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),

  -- What's being matched
  statement_transaction_id UUID REFERENCES statement_transactions(id),
  receipt_id UUID REFERENCES receipts(id),

  -- Match group (for partial payments)
  match_group_id UUID, -- Links related partial matches
  match_type TEXT NOT NULL,
  -- 'full_match': 1 receipt = 1 transaction
  -- 'partial_payment': 1 receipt = multiple transactions
  -- 'combined_receipts': multiple receipts = 1 transaction
  -- 'split_transaction': 1 transaction split across receipts

  -- Amounts
  amount_matched DECIMAL(12,2), -- How much of this transaction goes to this receipt
  percentage_of_receipt DECIMAL(5,2), -- What % of the receipt does this cover
  percentage_of_transaction DECIMAL(5,2), -- What % of the transaction does this use

  -- Match details
  confidence_score DECIMAL(3,2),
  match_reason JSONB,

  -- Audit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'confirmed',

  UNIQUE(statement_transaction_id, receipt_id)
);
```

#### Example 1: One Invoice, Two Payments

**Scenario:**
- Invoice: $1000.00 (Sept 4)
- Payment 1: $500.00 (Sept 10)
- Payment 2: $500.00 (Sept 17)

**Database Records:**
```sql
-- Match 1
INSERT INTO transaction_matches (
  match_group_id, -- ABC123
  receipt_id, -- Invoice ($1000)
  statement_transaction_id, -- Payment 1 ($500)
  match_type, -- 'partial_payment'
  amount_matched, -- $500
  percentage_of_receipt, -- 50%
  percentage_of_transaction -- 100%
);

-- Match 2
INSERT INTO transaction_matches (
  match_group_id, -- ABC123 (same group)
  receipt_id, -- Invoice ($1000)
  statement_transaction_id, -- Payment 2 ($500)
  match_type, -- 'partial_payment'
  amount_matched, -- $500
  percentage_of_receipt, -- 50%
  percentage_of_transaction -- 100%
);
```

**UI Display:**
```
Receipt: Invoice #1234, Sept 4, $1000.00
├─ Payment 1: Sept 10, $500.00 (50%) ✅
├─ Payment 2: Sept 17, $500.00 (50%) ✅
└─ Status: Fully Paid ✅
```

#### Example 2: Multiple Invoices, One Payment

**Scenario:**
- Invoice A: $300.00 (Sept 1)
- Invoice B: $200.00 (Sept 3)
- Payment: $500.00 (Sept 10) - pays both invoices

**Database Records:**
```sql
-- Match 1
INSERT INTO transaction_matches (
  match_group_id, -- XYZ789
  receipt_id, -- Invoice A ($300)
  statement_transaction_id, -- Payment ($500)
  match_type, -- 'combined_receipts'
  amount_matched, -- $300
  percentage_of_receipt, -- 100%
  percentage_of_transaction -- 60%
);

-- Match 2
INSERT INTO transaction_matches (
  match_group_id, -- XYZ789 (same group)
  receipt_id, -- Invoice B ($200)
  statement_transaction_id, -- Payment ($500)
  match_type, -- 'combined_receipts'
  amount_matched, -- $200
  percentage_of_receipt, -- 100%
  percentage_of_transaction -- 40%
);
```

**UI Display:**
```
Transaction: Sept 10, $500.00
├─ Invoice A: Sept 1, $300.00 (60% of payment) ✅
├─ Invoice B: Sept 3, $200.00 (40% of payment) ✅
└─ Status: Fully Allocated ✅
```

**UI for Creating Partial Matches:**
```
┌─────────────────────────────────────────────┐
│ Manual Partial Payment Match                │
├─────────────────────────────────────────────┤
│ Transaction: $500.00, Sept 10               │
│                                             │
│ Select receipts to match:                   │
│ ☑ Invoice A: $300.00 (Sept 1)              │
│ ☑ Invoice B: $200.00 (Sept 3)              │
│ ☐ Invoice C: $150.00 (Sept 5)              │
│                                             │
│ Selected Total: $500.00                     │
│ Transaction Amount: $500.00                 │
│ Difference: $0.00 ✅                        │
│                                             │
│ [Create Match Group]                        │
└─────────────────────────────────────────────┘
```

---

### 6. Accountant View (Unified Transactions)

**Requirement:** Show matched items as single entry, unmatched items separately

#### Unified Transaction List View

```typescript
interface UnifiedTransactionView {
  // Unique identifier
  unified_id: string; // Either match_id or transaction_id or receipt_id

  // Status
  status: 'fully_matched' | 'partially_matched' | 'unmatched_receipt' | 'unmatched_transaction' | 'cash_payment';

  // Receipt data (if exists)
  receipt: {
    id: string;
    date: Date;
    vendor: string;
    amount: number;
    category: string;
    image_url: string;
    description: string;
  } | null;

  // Transaction data (if exists)
  transaction: {
    id: string;
    date: Date;
    merchant: string;
    amount: number;
    account_last4: string;
    statement_type: 'bank' | 'credit_card';
    reference_number: string;
  } | null;

  // Match details (if matched)
  match: {
    confidence: number;
    match_type: 'full_match' | 'partial_payment' | 'combined_receipts';
    match_group_id: string | null; // For grouped partial payments
    matched_at: Date;
    matched_by: string;
  } | null;

  // Differences (if matched but not exact)
  differences: {
    date_diff_days: number;
    amount_diff: number;
    amount_diff_pct: number;
  } | null;
}
```

#### Dashboard View

```
┌─────────────────────────────────────────────────────────┐
│ Reconciliation Dashboard                                │
├─────────────────────────────────────────────────────────┤
│ Filter: [All Transactions ▼] [September 2025 ▼]        │
│ View: ○ All  ● Matched Only  ○ Unmatched Only          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ MATCHED (120 transactions)                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                         │
│ Sept 6, 2025 • Home Depot • $123.45                    │
│ 📄 Receipt: Sept 4, 2025                               │
│ 💳 CC Payment: Sept 6, 2025 (*1234)                   │
│ Match: 97% confidence                                   │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ Sept 10, 2025 • Restaurant ABC • $60.00                │
│ 📄 Receipt: $50.00 (Sept 10)                           │
│ 💳 CC Payment: $60.00 (Sept 10) (*1234)               │
│ Match: 89% confidence • $10 tip                         │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ ⚠️ PARTIALLY MATCHED (5 transactions)                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                         │
│ Sept 10, 2025 • Invoice #1234 • $1000.00              │
│ 📄 Receipt: $1000.00 (Sept 4)                          │
│ 💳 Payment 1: $500.00 (Sept 10) (*1234) [50%]         │
│ ⏳ Payment 2: $500.00 (Pending)                        │
│ Status: 50% paid, $500 outstanding                      │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ ❌ UNMATCHED RECEIPTS (8 receipts)                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                         │
│ Sept 10, 2025 • Staples • $45.20                       │
│ 📄 Receipt uploaded                                     │
│ ⚠️ No payment record found                             │
│ [View Possible Matches] [Mark as Cash Payment]         │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ ❌ UNMATCHED TRANSACTIONS (10 transactions)            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                         │
│ Sept 12, 2025 • AMAZON • $99.00                        │
│ 💳 CC Payment: Sept 12 (*1234)                         │
│ ⚠️ Missing receipt                                     │
│ [Upload Receipt] [View Possible Matches]               │
│ ─────────────────────────────────────────────────────  │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
1. **Matched items show once** - Combined view, not duplicated
2. **Unmatched items show separately** - Clear what's missing
3. **Partial matches clearly marked** - Show progress (50% paid)
4. **Actions available** - Upload missing docs, match manually
5. **Export options** - For accountant (matched only, all items, etc.)

---

### 7. Edge Cases - All Handled

#### A. Refunds & Returns

**Scenario:** Customer returns item, gets refund

**Implementation:**
```sql
-- Transaction type includes refunds
statement_transactions.transaction_type = 'refund'

-- Match refund to original purchase
transaction_matches.match_type = 'refund_match'
```

**UI Display:**
```
Sept 6, 2025 • Home Depot • Purchase $123.45 ✅
  📄 Original Receipt: $123.45
  💳 Payment: $123.45

Sept 8, 2025 • Home Depot • Return -$123.45 🔄
  📄 Return Receipt: -$123.45
  💳 Refund: -$123.45
  ↩️ Linked to purchase from Sept 6
```

**Features:**
- Detect negative amounts as potential refunds
- Suggest matching to recent purchases from same merchant
- Calculate net amount (purchase - return)
- Show in reports appropriately

#### B. Recurring Subscriptions

**Scenario:** Netflix charges $15.99 every month

**Implementation:**
```sql
CREATE TABLE recurring_patterns (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  merchant_pattern TEXT, -- 'Netflix'
  expected_amount DECIMAL(12,2), -- $15.99
  frequency TEXT, -- 'monthly', 'yearly', 'weekly'
  day_of_month INTEGER, -- 15 (charges on 15th)
  last_matched_date DATE,
  times_detected INTEGER DEFAULT 0,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**How it works:**
1. System detects: "Netflix, $15.99" appears 3 months in a row
2. Creates recurring pattern
3. Next month: "Netflix, $15.99" arrives → Auto-match with 95% confidence
4. Only asks for receipt once, applies to all future charges
5. If amount changes ($15.99 → $17.99), flags for review

**UI Display:**
```
Recurring Subscription Detected:
┌─────────────────────────────────────────────┐
│ Netflix - $15.99/month                      │
│ Charges on: 15th of each month              │
│ Last 3 months: ✅ Matched automatically     │
│                                             │
│ Upload one receipt for subscription?        │
│ [Upload Receipt] [Skip - Mark as Expense]  │
│                                             │
│ □ Auto-match future Netflix charges        │
└─────────────────────────────────────────────┘
```

#### C. Cash Transactions

**Scenario:** Receipt exists, but payment was cash (no bank record)

**Implementation:**
```sql
-- Add flag to receipts
ALTER TABLE receipts ADD COLUMN payment_method TEXT;
-- Values: 'card', 'cash', 'check', 'wire', 'unknown'

-- Cash transactions won't show as "unmatched problems"
CREATE VIEW reconciliation_status AS
SELECT
  r.id,
  CASE
    WHEN r.payment_method = 'cash' THEN 'cash_payment'
    WHEN tm.id IS NOT NULL THEN 'matched'
    ELSE 'unmatched'
  END as status
FROM receipts r
LEFT JOIN transaction_matches tm ON r.id = tm.receipt_id;
```

**UI Display:**
```
┌─────────────────────────────────────────────┐
│ Receipt Details                             │
├─────────────────────────────────────────────┤
│ Vendor: Office Depot                        │
│ Date: Sept 15, 2025                         │
│ Amount: $45.20                              │
│                                             │
│ Payment Method: [Cash ▼]                   │
│                                             │
│ ℹ️ Cash payments won't be matched to       │
│    bank statements                          │
│                                             │
│ [Save]                                      │
└─────────────────────────────────────────────┘
```

**Dashboard Sections:**
```
✅ MATCHED (Card/Bank): 120
💵 CASH PAYMENTS: 15
⚠️ UNMATCHED (Need Review): 10
```

#### D. Foreign Currency

**Scenario:** Purchase in USD, payment in CAD

**Implementation:**
```sql
ALTER TABLE statement_transactions ADD COLUMN original_currency TEXT;
ALTER TABLE statement_transactions ADD COLUMN original_amount DECIMAL(12,2);
ALTER TABLE statement_transactions ADD COLUMN exchange_rate DECIMAL(10,6);

-- Store exchange rates
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY,
  from_currency TEXT, -- USD
  to_currency TEXT, -- CAD
  rate DECIMAL(10,6), -- 1.35
  rate_date DATE,
  source TEXT, -- 'bank', 'credit_card', 'api'
);
```

**Matching with FX:**
```typescript
function matchWithFX(receipt, transaction) {
  // Receipt: $100 USD
  // Transaction: $135 CAD

  // Get exchange rate for transaction date
  const rate = getExchangeRate('USD', 'CAD', transaction.date); // 1.35

  // Convert receipt amount
  const convertedAmount = receipt.amount * rate; // $100 * 1.35 = $135

  // Compare
  const diff = Math.abs(transaction.amount - convertedAmount); // $0

  if (diff < 5) {
    return {
      matched: true,
      confidence: 0.95,
      reason: 'Amount matches with FX conversion'
    };
  }
}
```

**UI Display:**
```
Sept 20, 2025 • US Vendor • $100.00 USD
📄 Receipt: $100.00 USD
💳 CC Payment: $135.20 CAD (@ 1.352 rate)
✅ Matched with FX conversion
```

#### E. Split Transactions

**Scenario:** One receipt, but paid with two different cards

**Implementation:**
Same as partial payments, just reversed:
- One receipt
- Multiple payment methods
- User manually groups them

**Example:**
```
Receipt: Home Depot, $500.00
├─ Personal CC: $300.00 (60%)
└─ Business CC: $200.00 (40%)

User action: "Split this receipt between personal and business"
Result: Two separate entries in reconciliation
```

---

## 🎯 Implementation Priority

Based on these requirements, here's the updated implementation order:

### Phase 1: Core Foundation (Weeks 1-3)
**Priority: CRITICAL**
- ✅ Database schema (all 8 tables)
- ✅ RLS policies
- ✅ PDF parser
- ✅ Basic transaction storage
- ✅ Statement upload UI

**Deliverable:** Can upload and parse statements

### Phase 2: Basic Matching (Weeks 4-5)
**Priority: HIGH**
- ✅ Simple 1-to-1 matching
- ✅ Manual drag-and-drop interface
- ✅ Match storage
- ✅ Bidirectional search (historical matching)

**Deliverable:** Can manually match everything

### Phase 3: Smart Matching (Weeks 6-8)
**Priority: HIGH**
- ✅ Fuzzy matching algorithm (30 days, 20% tolerance)
- ✅ Confidence scoring
- ✅ Suggested matches UI
- ✅ Learning system (merchant patterns)

**Deliverable:** 70-80% auto-matched

### Phase 4: Advanced Matching (Weeks 9-10)
**Priority: MEDIUM**
- ✅ Partial payments (many-to-many)
- ✅ Multiple business assignment
- ✅ Recurring subscription detection
- ✅ Cash payment handling

**Deliverable:** Handles complex scenarios

### Phase 5: Accountant Features (Weeks 11-12)
**Priority: MEDIUM**
- ✅ Unified transaction view
- ✅ Reconciliation dashboard
- ✅ Reports and exports
- ✅ Audit trail

**Deliverable:** Production-ready for accountants

### Phase 6: Polish (Weeks 13-14)
**Priority: LOW**
- ✅ CSV support
- ✅ Excel support
- ✅ Foreign currency
- ✅ Refund handling
- ✅ Mobile optimization

**Deliverable:** Enterprise-grade feature

---

## 📊 Updated Timeline

**MVP (Phases 1-2):** 5 weeks
**Production (Phases 1-3):** 8 weeks
**Full Feature (Phases 1-5):** 12 weeks
**Enterprise (All Phases):** 14 weeks

---

## 💰 Updated Cost Estimate

**Development:**
- 2 developers × 14 weeks = 28 developer-weeks
- At $50/hour, 40 hours/week = $56,000

**Infrastructure (Self-Hosted):**
- $0 (Unraid + Supabase)

**Total:** $56,000 one-time development cost

---

## ✅ Next Steps

1. ✅ Requirements finalized
2. ⏳ Approve database schema
3. ⏳ Approve timeline (MVP vs Full vs Enterprise)
4. ⏳ Begin Phase 1 development

---

**Ready to start implementation!** 🚀
