# Bank & Credit Card Reconciliation - Implementation Plan

## Executive Summary

This feature transforms Audit Proof from a simple receipt storage system into a comprehensive financial reconciliation platform. By uploading bank and credit card statements, the system will automatically match transactions to receipts, creating a complete audit trail that saves accountants hours of manual work.

---

## Problem Statement

### Current Pain Points

**For Business Owners:**
1. Upload receipts to Audit Proof (expense recorded)
2. Same expense appears on credit card statement (no link to receipt)
3. Same expense might appear on bank statement if paid by debit (no link)
4. Accountant has to manually match everything at tax time
5. Confusion about duplicates (is this the same expense or different?)

**For Accountants:**
1. Receive receipts from client
2. Receive bank/CC statements from client
3. Manually match each transaction:
   - Look at date (but dates often don't match)
   - Look at amount (but amounts often differ due to tips, FX)
   - Look at merchant name (but receipt says "Home Depot" and statement says "HOMEDEPOT #2341")
4. Spend 10-20 hours per client per year doing this manual matching
5. Miss transactions (human error)
6. Can't easily find missing receipts

### Date Mismatch Examples

| Scenario | Receipt Date | Payment Date | Days Apart |
|----------|-------------|--------------|------------|
| Gas Bill | Sept 4 (invoice) | Sept 10 (payment) | 6 days |
| Amazon Order | Dec 5 (order placed) | Dec 7 (item shipped/charged) | 2 days |
| Restaurant | Jan 15 (meal) | Jan 16 (tip added/posted) | 1 day |
| Subscription | Jan 1 (invoice) | Jan 5 (auto-payment) | 4 days |

### Amount Mismatch Examples

| Scenario | Receipt Amount | Statement Amount | Difference |
|----------|---------------|------------------|------------|
| Restaurant | $50.00 | $60.00 | +$10.00 tip |
| US Purchase | $100.00 USD | $135.20 CAD | Foreign exchange |
| Amazon | $49.99 | $56.49 | +$6.50 tax/shipping |
| Partial Payment | $1,000.00 invoice | $500.00 payment | Installment plan |

---

## Solution Overview

### What We'll Build

A 4-step reconciliation system:

1. **Upload Statements** - Client uploads bank/CC statements (PDF or CSV)
2. **Parse Transactions** - System extracts individual transactions from statements
3. **Auto-Match** - AI matches transactions to existing receipts
4. **Review & Confirm** - User reviews matches, manually matches unclear items

### Key Features

✅ **Smart Matching Algorithm**
- Fuzzy date matching (±7 days tolerance)
- Fuzzy amount matching (±10% or $5 tolerance)
- Merchant name matching (even when formats differ)
- AI-powered confidence scoring

✅ **Unified Transaction View**
- See receipt + bank transaction + CC transaction in one place
- Know instantly which expenses are "complete" (have all documentation)
- Identify missing receipts (transaction exists, no receipt)
- Identify unreconciled receipts (receipt exists, no payment record)

✅ **Accountant Dashboard**
- Reconciliation status at a glance
- Export matched transactions for tax prep
- Flag suspicious transactions (duplicates, unusual amounts)
- Generate reconciliation reports

✅ **Learning System**
- When user manually matches, system learns
- Future auto-matching improves over time
- Per-business matching rules

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│                  Client Upload                      │
│          (PDF/CSV Statement Files)                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Statement Parser Service                 │
│  - Extract transactions from PDF/CSV                │
│  - Identify bank/CC provider                        │
│  - Normalize transaction data                       │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│         Transaction Matching Engine                 │
│  - Fuzzy date/amount/merchant matching              │
│  - AI-powered confidence scoring                    │
│  - Apply learned matching rules                     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│          Manual Review Interface                    │
│  - Show high-confidence auto-matches (auto-approve) │
│  - Show uncertain matches (user confirms/rejects)   │
│  - Show unmatched items (user manually matches)     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│           Reconciliation Dashboard                  │
│  - Matched transactions                             │
│  - Unmatched receipts                               │
│  - Unmatched transactions                           │
│  - Reports for accountants                          │
└─────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- Store uploaded statement files
CREATE TABLE bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  statement_type TEXT NOT NULL, -- 'bank', 'credit_card', 'paypal', etc.
  institution_name TEXT, -- 'TD Bank', 'RBC', 'Visa', etc.
  account_last4 TEXT, -- Last 4 digits of account
  statement_period_start DATE,
  statement_period_end DATE,
  total_transactions INTEGER DEFAULT 0,
  matched_transactions INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  parsed_at TIMESTAMPTZ,
  parse_status TEXT DEFAULT 'pending', -- 'pending', 'parsing', 'completed', 'failed'
  parse_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Store individual transactions from statements
CREATE TABLE statement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID REFERENCES bank_statements(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_date DATE NOT NULL,
  post_date DATE, -- Date transaction posted (may differ from transaction date)
  description TEXT NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'CAD',
  transaction_type TEXT, -- 'debit', 'credit', 'fee', 'interest', 'refund'
  category TEXT, -- Merchant category (if available in statement)
  reference_number TEXT, -- Check number, reference code, etc.

  -- Matching status
  match_status TEXT DEFAULT 'unmatched', -- 'unmatched', 'auto_matched', 'manually_matched', 'ignored'
  matched_receipt_id UUID REFERENCES receipts(id),
  match_confidence DECIMAL(3,2), -- 0.00 to 1.00 (AI confidence score)
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES profiles(id),

  -- Metadata
  is_duplicate BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Store transaction matching records (audit trail)
CREATE TABLE transaction_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,

  -- What's matched
  statement_transaction_id UUID REFERENCES statement_transactions(id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,

  -- Match details
  match_type TEXT NOT NULL, -- 'auto', 'manual', 'suggested'
  confidence_score DECIMAL(3,2), -- AI confidence (0.00 to 1.00)
  match_reason JSONB, -- Details about why match was made

  -- Date/amount differences
  date_difference_days INTEGER, -- How many days apart
  amount_difference DECIMAL(12,2), -- Absolute difference in amounts
  amount_difference_pct DECIMAL(5,2), -- Percentage difference

  -- Audit trail
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_by UUID REFERENCES profiles(id),
  confirmed_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'

  UNIQUE(statement_transaction_id, receipt_id)
);

-- Store learned matching rules
CREATE TABLE matching_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,

  -- Rule definition
  merchant_pattern TEXT NOT NULL, -- e.g., 'HOME DEPOT', 'HOMEDEPOT', 'HD #%'
  normalized_merchant TEXT NOT NULL, -- e.g., 'Home Depot'
  category_id UUID REFERENCES expense_categories(id),

  -- Rule metadata
  times_applied INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(3,2), -- How often user confirms this rule
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Allow business to have multiple patterns for same merchant
  UNIQUE(business_id, merchant_pattern)
);

-- Store reconciliation sessions
CREATE TABLE reconciliation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES bank_statements(id),

  -- Session info
  started_by UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'

  -- Reconciliation results
  total_transactions INTEGER DEFAULT 0,
  auto_matched INTEGER DEFAULT 0,
  manually_matched INTEGER DEFAULT 0,
  unmatched INTEGER DEFAULT 0,
  ignored INTEGER DEFAULT 0,

  -- Time spent
  time_spent_seconds INTEGER,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Store unmatched items for accountant review
CREATE TABLE unmatched_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,

  -- What's unmatched
  item_type TEXT NOT NULL, -- 'receipt', 'transaction'
  receipt_id UUID REFERENCES receipts(id),
  statement_transaction_id UUID REFERENCES statement_transactions(id),

  -- Why unmatched
  reason TEXT, -- 'no_match_found', 'low_confidence', 'duplicate_suspected', 'manual_review_needed'
  suggested_matches JSONB, -- Array of possible matches with confidence scores

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_statement_transactions_business ON statement_transactions(business_id);
CREATE INDEX idx_statement_transactions_date ON statement_transactions(transaction_date);
CREATE INDEX idx_statement_transactions_merchant ON statement_transactions(merchant_name);
CREATE INDEX idx_statement_transactions_status ON statement_transactions(match_status);
CREATE INDEX idx_statement_transactions_amount ON statement_transactions(amount);
CREATE INDEX idx_statement_transactions_statement ON statement_transactions(statement_id);

CREATE INDEX idx_transaction_matches_receipt ON transaction_matches(receipt_id);
CREATE INDEX idx_transaction_matches_transaction ON transaction_matches(statement_transaction_id);
CREATE INDEX idx_transaction_matches_status ON transaction_matches(status);
CREATE INDEX idx_transaction_matches_business ON transaction_matches(business_id);

CREATE INDEX idx_matching_rules_business ON matching_rules(business_id);
CREATE INDEX idx_matching_rules_merchant ON matching_rules(merchant_pattern);

CREATE INDEX idx_bank_statements_business ON bank_statements(business_id);
CREATE INDEX idx_bank_statements_period ON bank_statements(statement_period_start, statement_period_end);

-- Search indexes
CREATE INDEX idx_statement_transactions_description_search ON statement_transactions
  USING gin(to_tsvector('english', description));
CREATE INDEX idx_statement_transactions_merchant_search ON statement_transactions
  USING gin(to_tsvector('english', merchant_name));
```

### Row Level Security (RLS)

```sql
-- Bank statements - only business members can see
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view bank statements"
  ON bank_statements FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can upload bank statements"
  ON bank_statements FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid()
    )
  );

-- Statement transactions - same as bank statements
ALTER TABLE statement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view statement transactions"
  ON statement_transactions FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid()
    )
  );

-- Transaction matches - business members only
ALTER TABLE transaction_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can manage matches"
  ON transaction_matches FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid()
    )
  );

-- Matching rules - business members only
ALTER TABLE matching_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can manage matching rules"
  ON matching_rules FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid()
    )
  );

-- Reconciliation sessions
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can manage reconciliation sessions"
  ON reconciliation_sessions FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid()
    )
  );

-- Unmatched items
ALTER TABLE unmatched_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view unmatched items"
  ON unmatched_items FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## Statement Parsing Service

### PDF Parsing Options

#### Option 1: PDF.js (Already Installed)
**Pros:**
- Already in project (pdfjs-dist)
- Works in browser
- No server-side dependency

**Cons:**
- Text extraction only (no table detection)
- Requires custom parsing logic per bank
- Can't handle image-based PDFs (scanned statements)

#### Option 2: Tabula-py (Python Service)
**Pros:**
- Excellent table extraction
- Handles most bank statement formats
- Open-source

**Cons:**
- Requires Python service
- Need Java runtime
- More infrastructure

#### Option 3: AI-Powered (Self-Hosted LLM)
**Pros:**
- Works with ANY format (even images)
- No custom parsing per bank
- Improves over time

**Cons:**
- Requires self-hosted AI (from previous plan)
- Slower than traditional parsing
- Uses more resources

**Recommendation:** Use PDF.js for initial implementation, add AI-powered parsing as enhancement.

### Statement Parser Edge Function

Create: `/supabase/functions/parse-bank-statement/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/+esm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const statementId = formData.get('statement_id') as string;
    const businessId = formData.get('business_id') as string;

    if (!file || !statementId) {
      return new Response(
        JSON.stringify({ error: 'Missing file or statement_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    // Detect bank/CC provider
    const provider = detectProvider(fullText);

    // Parse transactions based on provider
    const transactions = parseTransactions(fullText, provider);

    // Store transactions in database
    const insertPromises = transactions.map(async (txn) => {
      return supabase.from('statement_transactions').insert({
        statement_id: statementId,
        business_id: businessId,
        transaction_date: txn.date,
        description: txn.description,
        merchant_name: extractMerchantName(txn.description),
        amount: txn.amount,
        transaction_type: txn.type,
        match_status: 'unmatched'
      });
    });

    await Promise.all(insertPromises);

    // Update statement status
    await supabase.from('bank_statements').update({
      parsed_at: new Date().toISOString(),
      parse_status: 'completed',
      total_transactions: transactions.length
    }).eq('id', statementId);

    return new Response(
      JSON.stringify({
        success: true,
        transactions_parsed: transactions.length,
        provider: provider
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing statement:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function detectProvider(text: string): string {
  if (text.includes('TD Bank') || text.includes('TD Canada Trust')) return 'td';
  if (text.includes('Royal Bank') || text.includes('RBC')) return 'rbc';
  if (text.includes('Scotiabank')) return 'scotiabank';
  if (text.includes('BMO') || text.includes('Bank of Montreal')) return 'bmo';
  if (text.includes('CIBC')) return 'cibc';
  if (text.includes('Visa')) return 'visa';
  if (text.includes('Mastercard') || text.includes('MasterCard')) return 'mastercard';
  if (text.includes('American Express') || text.includes('Amex')) return 'amex';
  return 'unknown';
}

function parseTransactions(text: string, provider: string): ParsedTransaction[] {
  // This is simplified - real implementation would have provider-specific logic
  const transactions: ParsedTransaction[] = [];

  // Example pattern: "Jan 15 HOME DEPOT #2341 $123.45"
  const pattern = /(\w{3}\s+\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    transactions.push({
      date: parseDate(match[1]),
      description: match[2].trim(),
      amount: parseFloat(match[3].replace(',', '')),
      type: 'debit' // Determine from context or amount sign
    });
  }

  return transactions;
}

function parseDate(dateStr: string): string {
  // Convert "Jan 15" to "2025-01-15"
  // This is simplified - real implementation would handle year
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = dateStr.split(' ');
  const monthIdx = months.indexOf(parts[0]) + 1;
  const day = parts[1];
  const year = new Date().getFullYear(); // Assume current year

  return `${year}-${monthIdx.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractMerchantName(description: string): string {
  // Remove common prefixes/suffixes
  let merchant = description
    .replace(/^(PURCHASE|SALE|DEBIT|CREDIT)\s+/i, '')
    .replace(/\s+#\d+$/, '') // Remove store numbers
    .replace(/\s+\d{2}\/\d{2}$/, '') // Remove dates
    .trim();

  return merchant;
}
```

### CSV Parser

Many banks offer CSV export. Create: `/supabase/functions/parse-csv-statement/index.ts`

```typescript
// Similar to PDF parser but for CSV files
// Use Papa Parse or similar library
// Map CSV columns to our transaction schema
```

---

## Matching Engine

### Matching Algorithm

Create: `/supabase/functions/match-transactions/index.ts`

```typescript
interface MatchCandidate {
  receipt: Receipt;
  transaction: StatementTransaction;
  score: number;
  reasons: string[];
  dateDiff: number;
  amountDiff: number;
}

async function findMatches(
  businessId: string,
  statementId: string
): Promise<MatchCandidate[]> {

  // Get unmatched transactions from statement
  const { data: transactions } = await supabase
    .from('statement_transactions')
    .select('*')
    .eq('statement_id', statementId)
    .eq('match_status', 'unmatched');

  // Get unmatched receipts (±30 days of statement period)
  const { data: receipts } = await supabase
    .from('receipts')
    .select('*')
    .eq('business_id', businessId)
    .is('matched_transaction_id', null)
    .gte('transaction_date', statementStart)
    .lte('transaction_date', statementEnd);

  const matches: MatchCandidate[] = [];

  // For each transaction, find best matching receipt
  for (const txn of transactions) {
    for (const receipt of receipts) {
      const score = calculateMatchScore(txn, receipt);

      if (score >= 0.7) { // 70% confidence threshold
        matches.push({
          transaction: txn,
          receipt: receipt,
          score: score,
          reasons: getMatchReasons(txn, receipt),
          dateDiff: Math.abs(dateDiff(txn.transaction_date, receipt.transaction_date)),
          amountDiff: Math.abs(txn.amount - receipt.total_amount)
        });
      }
    }
  }

  // Sort by score (highest first)
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

function calculateMatchScore(
  txn: StatementTransaction,
  receipt: Receipt
): number {
  let score = 0;
  const weights = {
    exactAmount: 0.4,
    similarAmount: 0.2,
    dateClose: 0.3,
    merchantMatch: 0.3
  };

  // Exact amount match (most important)
  if (Math.abs(txn.amount - receipt.total_amount) < 0.01) {
    score += weights.exactAmount;
  } else if (Math.abs(txn.amount - receipt.total_amount) <= 5.00) {
    // Within $5 (could be tip or small fee)
    score += weights.similarAmount;
  } else if (Math.abs(txn.amount - receipt.total_amount) / receipt.total_amount <= 0.1) {
    // Within 10% (could be FX or partial payment)
    score += weights.similarAmount * 0.5;
  }

  // Date proximity
  const daysDiff = Math.abs(dateDiff(txn.transaction_date, receipt.transaction_date));
  if (daysDiff === 0) {
    score += weights.dateClose;
  } else if (daysDiff <= 3) {
    score += weights.dateClose * 0.7;
  } else if (daysDiff <= 7) {
    score += weights.dateClose * 0.4;
  } else if (daysDiff <= 14) {
    score += weights.dateClose * 0.2;
  }

  // Merchant name similarity
  const merchantSimilarity = calculateStringSimilarity(
    normalizeMerchantName(txn.merchant_name),
    normalizeMerchantName(receipt.vendor_name)
  );
  score += weights.merchantMatch * merchantSimilarity;

  return score;
}

function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .replace(/\s+/g, '') // Remove spaces
    .replace(/ltd|inc|corp|llc/g, '') // Remove business suffixes
    .replace(/\d+/g, ''); // Remove numbers (store IDs)
}

function calculateStringSimilarity(str1: string, str2: string): number {
  // Levenshtein distance / longest string length
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  return 1 - (distance / maxLen);
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function getMatchReasons(txn: StatementTransaction, receipt: Receipt): string[] {
  const reasons = [];

  if (Math.abs(txn.amount - receipt.total_amount) < 0.01) {
    reasons.push('Exact amount match');
  }

  if (txn.transaction_date === receipt.transaction_date) {
    reasons.push('Same date');
  }

  const merchantSim = calculateStringSimilarity(
    normalizeMerchantName(txn.merchant_name),
    normalizeMerchantName(receipt.vendor_name)
  );

  if (merchantSim > 0.8) {
    reasons.push('Merchant name very similar');
  }

  return reasons;
}
```

### AI-Powered Matching (Enhancement)

Use self-hosted LLM to improve matching:

```typescript
async function aiMatchTransactions(
  txn: StatementTransaction,
  receipts: Receipt[]
): Promise<{ receipt: Receipt; confidence: number }> {

  const prompt = `
You are a financial reconciliation expert. Match this bank transaction to the most likely receipt.

Transaction:
- Date: ${txn.transaction_date}
- Merchant: ${txn.description}
- Amount: $${txn.amount}

Possible Receipts:
${receipts.map((r, i) => `
${i + 1}. Date: ${r.transaction_date}, Vendor: ${r.vendor_name}, Amount: $${r.total_amount}
`).join('')}

Which receipt (1-${receipts.length}) is the best match? Or 0 if no good match.
Also provide confidence score (0-100).

Response format: {"receipt_number": X, "confidence": Y, "reason": "explanation"}
`;

  const response = await fetch(`${LLM_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt: prompt,
      format: 'json'
    })
  });

  const result = await response.json();
  const match = JSON.parse(result.response);

  if (match.receipt_number > 0 && match.confidence >= 70) {
    return {
      receipt: receipts[match.receipt_number - 1],
      confidence: match.confidence / 100
    };
  }

  return null;
}
```

---

## User Interface Components

### 1. Statement Upload Page

**Location:** `/src/pages/ReconciliationPage.tsx`

```typescript
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, FileText, CreditCard, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ReconciliationPage() {
  const { businessId } = useParams();
  const [uploading, setUploading] = useState(false);
  const [statements, setStatements] = useState([]);

  const handleFileUpload = async (file: File, type: 'bank' | 'credit_card') => {
    setUploading(true);

    try {
      // Upload file to storage
      const fileName = `${businessId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('statements')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create statement record
      const { data: statement, error: insertError } = await supabase
        .from('bank_statements')
        .insert({
          business_id: businessId,
          file_path: uploadData.path,
          file_name: file.name,
          statement_type: type,
          parse_status: 'pending'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger parsing
      await fetch(`${SUPABASE_URL}/functions/v1/parse-bank-statement`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          statement_id: statement.id,
          file_path: uploadData.path
        })
      });

      alert('Statement uploaded! Parsing in progress...');

    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload statement');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Bank Reconciliation</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Bank Statement Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 cursor-pointer">
          <input
            type="file"
            accept=".pdf,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, 'bank');
            }}
            className="hidden"
            id="bank-upload"
          />
          <label htmlFor="bank-upload" className="cursor-pointer">
            <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Bank Statement</h3>
            <p className="text-sm text-gray-600">PDF or CSV format</p>
          </label>
        </div>

        {/* Credit Card Statement Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 cursor-pointer">
          <input
            type="file"
            accept=".pdf,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, 'credit_card');
            }}
            className="hidden"
            id="cc-upload"
          />
          <label htmlFor="cc-upload" className="cursor-pointer">
            <CreditCard className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Credit Card Statement</h3>
            <p className="text-sm text-gray-600">PDF or CSV format</p>
          </label>
        </div>
      </div>

      {/* Uploaded Statements List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Recent Statements</h2>
        </div>
        <div className="p-6">
          {/* Statement list will go here */}
        </div>
      </div>
    </div>
  );
}
```

### 2. Transaction Matching Interface

**Location:** `/src/components/reconciliation/TransactionMatcher.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Check, X, HelpCircle } from 'lucide-react';

interface MatchSuggestion {
  transaction: StatementTransaction;
  receipt: Receipt;
  confidence: number;
  reasons: string[];
}

export default function TransactionMatcher({ statementId }: { statementId: string }) {
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadMatchSuggestions();
  }, [statementId]);

  const loadMatchSuggestions = async () => {
    // Call matching engine
    const response = await fetch(`/api/match-transactions?statement_id=${statementId}`);
    const data = await response.json();
    setSuggestions(data.suggestions);
  };

  const handleAccept = async (suggestion: MatchSuggestion) => {
    await supabase.from('transaction_matches').insert({
      statement_transaction_id: suggestion.transaction.id,
      receipt_id: suggestion.receipt.id,
      match_type: 'auto',
      confidence_score: suggestion.confidence,
      status: 'confirmed'
    });

    // Move to next
    setCurrentIndex(currentIndex + 1);
  };

  const handleReject = () => {
    setCurrentIndex(currentIndex + 1);
  };

  if (suggestions.length === 0) {
    return <div>No matches to review</div>;
  }

  const current = suggestions[currentIndex];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4 text-sm text-gray-600">
        Reviewing {currentIndex + 1} of {suggestions.length}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Transaction */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-4">Bank/CC Transaction</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Date:</span>
              <span className="ml-2 font-medium">{current.transaction.transaction_date}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Merchant:</span>
              <span className="ml-2 font-medium">{current.transaction.description}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="ml-2 font-medium">${current.transaction.amount}</span>
            </div>
          </div>
        </div>

        {/* Receipt */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="font-semibold mb-4">Receipt</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Date:</span>
              <span className="ml-2 font-medium">{current.receipt.transaction_date}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Vendor:</span>
              <span className="ml-2 font-medium">{current.receipt.vendor_name}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="ml-2 font-medium">${current.receipt.total_amount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Match Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center mb-2">
          <HelpCircle className="w-5 h-5 text-blue-500 mr-2" />
          <span className="font-semibold">Match Confidence: {(current.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Reasons:</strong>
          <ul className="list-disc list-inside mt-1">
            {current.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-center space-x-4">
        <button
          onClick={() => handleReject()}
          className="px-6 py-3 bg-red-500 text-white rounded-lg flex items-center hover:bg-red-600"
        >
          <X className="w-5 h-5 mr-2" />
          Not a Match
        </button>
        <button
          onClick={() => handleAccept(current)}
          className="px-6 py-3 bg-green-500 text-white rounded-lg flex items-center hover:bg-green-600"
        >
          <Check className="w-5 h-5 mr-2" />
          Confirm Match
        </button>
      </div>
    </div>
  );
}
```

### 3. Reconciliation Dashboard

**Location:** `/src/components/reconciliation/ReconciliationDashboard.tsx`

Shows:
- Total transactions imported
- Auto-matched (high confidence)
- Needs review (medium confidence)
- Unmatched (no match found)
- Missing receipts (transaction without receipt)
- Unreconciled receipts (receipt without transaction)

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Basic statement upload and parsing

**Tasks:**
- [ ] Create database tables and RLS policies
- [ ] Create statement upload UI
- [ ] Implement PDF parser (basic)
- [ ] Store transactions in database
- [ ] Display uploaded statements list

**Deliverables:**
- Can upload PDF statements
- System extracts transactions (basic parsing)
- View list of transactions

---

### Phase 2: Manual Matching (Weeks 3-4)
**Goal:** Allow users to manually match transactions

**Tasks:**
- [ ] Create transaction list view
- [ ] Create receipt list view (unmatched)
- [ ] Drag-and-drop matching interface
- [ ] Store matches in database
- [ ] Update receipt status when matched

**Deliverables:**
- See all unmatched transactions
- See all unmatched receipts
- Manually match them (drag receipt to transaction)
- View matched items

---

### Phase 3: Auto-Matching (Weeks 5-6)
**Goal:** Automatic transaction matching

**Tasks:**
- [ ] Implement matching algorithm
- [ ] Calculate confidence scores
- [ ] Auto-match high-confidence items (95%+)
- [ ] Show suggested matches for review (70-94%)
- [ ] Learn from user confirmations/rejections

**Deliverables:**
- System automatically matches obvious items
- Suggests matches for user review
- Improves over time as user confirms matches

---

### Phase 4: Reconciliation Dashboard (Weeks 7-8)
**Goal:** Complete reconciliation view

**Tasks:**
- [ ] Create reconciliation dashboard
- [ ] Show matched/unmatched summary
- [ ] Missing receipts report
- [ ] Unreconciled receipts report
- [ ] Export reconciliation report for accountant

**Deliverables:**
- Complete reconciliation view
- Identify gaps (missing documentation)
- Export reports

---

### Phase 5: Advanced Features (Weeks 9-12)
**Goal:** Polish and enhance

**Tasks:**
- [ ] CSV statement import
- [ ] Multiple statements at once
- [ ] Duplicate detection
- [ ] Partial payment handling
- [ ] Foreign currency support
- [ ] AI-powered matching (using self-hosted LLM)
- [ ] Mobile app support
- [ ] Bulk actions (match multiple at once)

---

## Integration with Self-Hosted AI

Use the self-hosted AI (from previous plan) to enhance matching:

**Use Cases:**
1. **OCR for Image-Based PDFs** - Some statements are scanned images, not text
2. **Intelligent Matching** - LLM understands context better than rules
3. **Merchant Name Normalization** - "AMZN Mktp" → "Amazon Marketplace"
4. **Category Suggestion** - Auto-categorize transactions based on merchant

**Example:**
```typescript
// Use AI to normalize merchant name
const aiResponse = await fetch(`${AI_ORCHESTRATOR_URL}/normalize-merchant`, {
  method: 'POST',
  body: JSON.stringify({
    raw_description: "AMZN MKTP US*2A3B4C5D6"
  })
});

const result = await aiResponse.json();
// { normalized_name: "Amazon", category: "Office Supplies" }
```

---

## Accountant Features

### Reconciliation Report

Generate report showing:
- Total transactions: 150
- Auto-matched: 120 (80%)
- Manually matched: 20 (13%)
- Unmatched: 10 (7%)
- Missing receipts: 5
- Unreconciled receipts: 8

### Export Options
- PDF report (for client file)
- Excel export (for further analysis)
- Tax package (matched items only, ready for tax prep)

### Accountant Dashboard

Special view for accountants showing:
- Clients with pending reconciliation
- Clients with missing documentation
- Unusual transactions flagged for review

---

## Success Metrics

### For Business Owners
- Time saved: 10+ hours per year
- Missing receipts identified: Prevent $X in missed deductions
- Duplicate expenses caught: Save $X

### For Accountants
- Reconciliation time reduced: From 20 hours → 2 hours per client
- Accuracy improved: 99%+ matching accuracy
- Client satisfaction: Faster turnaround, better documentation

---

## Security Considerations

### Data Privacy
- Bank statements contain sensitive information
- Must be encrypted at rest and in transit
- Access restricted to business members only
- Audit trail of who viewed what

### Compliance
- PCI DSS: Not storing card numbers, only transactions
- PIPEDA: Data stays in Canada (Supabase in Canada)
- SOX: Audit trail of all matches/changes

---

## Testing Plan

### Unit Tests
- Matching algorithm accuracy
- Merchant name normalization
- Date/amount fuzzy matching

### Integration Tests
- Upload statement → Parse → Match → Verify
- Manual match → Update database → Verify
- Multi-user scenarios

### User Acceptance Testing
- 5 business owners test with real statements
- 2 accountants review reconciliation reports
- Measure time savings vs. manual process

---

## Rollout Plan

### Beta Testing (Month 1)
- 10 pilot users
- Collect feedback
- Fix critical bugs
- Refine matching algorithm

### Limited Release (Month 2)
- 50 users
- Monitor performance
- Track matching accuracy
- Gather feature requests

### General Availability (Month 3)
- All users
- Marketing push
- Training materials
- Support documentation

---

## Cost Estimate

### Development
- 2 developers × 12 weeks = 24 developer-weeks
- At $50/hour, 40 hours/week = $48,000

### Infrastructure (Self-Hosted on Unraid)
- Storage: 100GB for statements ($0 - included in Unraid)
- Processing: CPU/GPU for matching ($0 - existing hardware)
- Database: Supabase (self-hosted) ($0)

**Total Cost:** $48,000 development (one-time)

### Revenue Potential
- Charge $10/month premium feature
- 1,000 users = $10,000/month = $120,000/year
- ROI: 2.5x in first year

---

## Alternative: Phase It In

If 12 weeks is too long, start with Phase 1-2 (Manual Matching):

**Quick Implementation (4 weeks):**
1. Upload statements
2. Parse transactions
3. Manual drag-and-drop matching
4. Basic reconciliation view

**Then add auto-matching later** as enhancement.

---

## Questions for Review

Before starting implementation, please confirm:

1. **CSV Support:** Should we support CSV from day 1, or PDF only initially?
2. **Matching Tolerance:** Are ±7 days and ±$5 reasonable defaults?
3. **Accountant Access:** Should accountants have a separate role/permissions?
4. **Historical Matching:** Match old receipts to new statements, or only forward-looking?
5. **Mobile:** Is mobile app support needed for statement upload?
6. **AI Priority:** Use AI matching from day 1, or start with rule-based?

---

## Next Steps

1. Review this plan
2. Prioritize features (must-have vs. nice-to-have)
3. Confirm timeline (12 weeks full, or 4 weeks MVP?)
4. Approve database schema
5. Begin Phase 1 implementation

---

**This feature will be a game-changer for Audit Proof!**
