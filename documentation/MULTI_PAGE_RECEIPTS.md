# Multi-Page Receipt Handling - Implementation Guide

**Last Updated:** 2025-10-11
**Status:** Design Document
**Priority:** 🟡 Medium - Valuable feature for user experience

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current System Analysis](#current-system-analysis)
3. [Solution Architecture](#solution-architecture)
4. [Database Schema Changes](#database-schema-changes)
5. [Implementation Plan](#implementation-plan)
6. [UI/UX Design](#uiux-design)
7. [Technical Considerations](#technical-considerations)
8. [Cost Analysis](#cost-analysis)
9. [Alternative Approaches](#alternative-approaches)
10. [Rollout Strategy](#rollout-strategy)

---

## Problem Statement

### Real-World Scenarios

**Common multi-page receipt situations:**
1. **Restaurant bills** - Multiple pages for large groups (itemized orders, tips, breakdown)
2. **Hotel invoices** - Room charges, mini-bar, services across 2-3 pages
3. **Retail receipts** - Long shopping lists that span multiple pages
4. **Service invoices** - Detailed breakdowns with terms and conditions
5. **Medical bills** - Multiple pages with itemized procedures
6. **Corporate expenses** - Detailed reports with attachments

**Current System Limitations:**
- ❌ Only handles single-page receipts
- ❌ Users must upload multi-page receipts as separate entries
- ❌ No way to link related receipt pages
- ❌ Extraction treats each page independently
- ❌ Difficult to view complete receipt context
- ❌ Reporting shows duplicate entries instead of one multi-page receipt

**User Pain Points:**
- "I have a 3-page restaurant receipt but can only upload page 1"
- "My reports show the same receipt 3 times instead of once"
- "I can't see all pages of my hotel invoice together"
- "The total amount is split across multiple entries"

---

## Current System Analysis

### Existing Receipt Model

**Database Schema (receipts table):**
```sql
receipts:
  - id (uuid, PK)
  - collection_id (uuid, FK)
  - vendor_name (text)
  - transaction_date (timestamptz)
  - total_amount (decimal)
  - file_path (text) -- SINGLE file only
  - thumbnail_path (text) -- SINGLE thumbnail
  - extraction_status (text)
  - extraction_data (jsonb)
  ...
```

**Key Observations:**
- ✅ Well-designed for single-page receipts
- ❌ `file_path` is a single string, not an array
- ❌ No concept of "parent" or "child" receipts
- ❌ No page ordering mechanism
- ❌ Extraction assumes one image = one receipt

**Current Upload Flow:**
```
User selects file → ReceiptUpload component →
Single file uploaded → Storage: receipts/{receipt_id}/file.jpg →
Edge Function: extract-receipt-data (single image) →
One database record created
```

---

## Solution Architecture

### Three Approaches Evaluated

#### ✅ Approach 1: Parent-Child Receipt Model (RECOMMENDED)

**Concept:** Create a "parent receipt" that has multiple "page" children

**Pros:**
- ✅ Minimal schema changes (add `parent_receipt_id`, `page_number`)
- ✅ Backward compatible (single-page receipts work as-is)
- ✅ Easy to query: "Get all pages for receipt X"
- ✅ Can show consolidated view or page-by-page
- ✅ Extraction can run per-page or combined

**Cons:**
- ⚠️ Slightly more complex queries
- ⚠️ Need to decide: which page has the "main" data?

---

#### Approach 2: Separate Pages Table

**Concept:** New `receipt_pages` table with FK to `receipts`

**Pros:**
- ✅ Clean separation of concerns
- ✅ Unlimited pages per receipt

**Cons:**
- ❌ Major schema change
- ❌ More complex queries (JOINs required)
- ❌ Migration complexity for existing receipts

---

#### Approach 3: Array of File Paths (JSONB)

**Concept:** Change `file_path` from `text` to `jsonb` array

**Pros:**
- ✅ Simple schema change

**Cons:**
- ❌ Loses PostgreSQL type safety
- ❌ Harder to query individual pages
- ❌ No page metadata (which page is which?)
- ❌ Difficult for reporting

---

### Selected Approach: Parent-Child Model

**Why this works best:**
1. **Backward Compatible:** Existing receipts continue to work (just set `parent_receipt_id = NULL`)
2. **Flexible:** Can represent 1-100 pages easily
3. **Query-Friendly:** Simple SQL to get all pages
4. **Extraction-Friendly:** Can extract per-page or combine images
5. **UI-Friendly:** Easy to show single view or multi-page carousel

---

## Database Schema Changes

### Migration: Add Multi-Page Support

**File:** `20251011140000_add_multipage_receipt_support.sql`

```sql
/*
  # Add Multi-Page Receipt Support

  ## Changes
  1. Add parent_receipt_id column to receipts table
  2. Add page_number column for ordering
  3. Add is_parent boolean flag
  4. Create self-referencing foreign key
  5. Add indexes for performance
  6. Update RLS policies

  ## Backward Compatibility
  - Existing receipts work as-is (parent_receipt_id = NULL)
  - Single-page receipts remain unchanged
*/

-- Step 1: Add new columns to receipts table
ALTER TABLE receipts
  ADD COLUMN parent_receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  ADD COLUMN page_number integer DEFAULT 1,
  ADD COLUMN is_parent boolean DEFAULT false,
  ADD COLUMN total_pages integer DEFAULT 1;

-- Step 2: Create indexes for performance
CREATE INDEX idx_receipts_parent_id ON receipts(parent_receipt_id)
  WHERE parent_receipt_id IS NOT NULL;

CREATE INDEX idx_receipts_is_parent ON receipts(is_parent)
  WHERE is_parent = true;

-- Step 3: Add constraint to ensure valid page numbers
ALTER TABLE receipts
  ADD CONSTRAINT valid_page_number
  CHECK (page_number > 0 AND page_number <= total_pages);

-- Step 4: Add constraint to prevent circular references
ALTER TABLE receipts
  ADD CONSTRAINT no_circular_parent
  CHECK (id != parent_receipt_id);

-- Step 5: Create helper function to get all pages for a receipt
CREATE OR REPLACE FUNCTION get_receipt_pages(receipt_uuid uuid)
RETURNS TABLE (
  id uuid,
  page_number integer,
  file_path text,
  thumbnail_path text,
  extraction_data jsonb
) AS $$
BEGIN
  -- Check if this is a parent receipt
  IF EXISTS (SELECT 1 FROM receipts WHERE receipts.id = receipt_uuid AND is_parent = true) THEN
    -- Return all child pages, ordered by page_number
    RETURN QUERY
    SELECT
      r.id,
      r.page_number,
      r.file_path,
      r.thumbnail_path,
      r.extraction_data
    FROM receipts r
    WHERE r.parent_receipt_id = receipt_uuid
    ORDER BY r.page_number;
  ELSE
    -- Return just this receipt (single page)
    RETURN QUERY
    SELECT
      r.id,
      r.page_number,
      r.file_path,
      r.thumbnail_path,
      r.extraction_data
    FROM receipts r
    WHERE r.id = receipt_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create helper function to get parent receipt
CREATE OR REPLACE FUNCTION get_parent_receipt(receipt_uuid uuid)
RETURNS uuid AS $$
DECLARE
  parent_id uuid;
BEGIN
  SELECT parent_receipt_id INTO parent_id
  FROM receipts
  WHERE id = receipt_uuid;

  -- If this is a child, return parent. Otherwise return itself.
  IF parent_id IS NOT NULL THEN
    RETURN parent_id;
  ELSE
    RETURN receipt_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Update RLS policies (if needed)
-- RLS policies automatically cascade to child pages through parent_receipt_id

-- Step 8: Add comments for documentation
COMMENT ON COLUMN receipts.parent_receipt_id IS
  'If this receipt is part of a multi-page receipt, this references the parent receipt. NULL for single-page or parent receipts.';

COMMENT ON COLUMN receipts.page_number IS
  'Page number within multi-page receipt. Always 1 for single-page receipts.';

COMMENT ON COLUMN receipts.is_parent IS
  'True if this receipt is a parent with child pages. False for single-page or child receipts.';

COMMENT ON COLUMN receipts.total_pages IS
  'Total number of pages in this receipt. 1 for single-page, N for multi-page parent.';
```

---

### Example Data Structure

#### Single-Page Receipt (No Change)

```sql
INSERT INTO receipts (
  id,
  collection_id,
  vendor_name,
  total_amount,
  file_path,
  parent_receipt_id,  -- NULL
  page_number,        -- 1
  is_parent,          -- false
  total_pages         -- 1
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Starbucks',
  12.50,
  'receipts/111.../file.jpg',
  NULL,
  1,
  false,
  1
);
```

#### Multi-Page Receipt (3 pages)

**Parent Receipt:**
```sql
INSERT INTO receipts (
  id,
  collection_id,
  vendor_name,
  total_amount,
  file_path,              -- NULL or page 1 path
  parent_receipt_id,      -- NULL (this is the parent)
  page_number,            -- 1
  is_parent,              -- true
  total_pages             -- 3
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Marriott Hotel',
  456.78,
  NULL,  -- Or optionally store combined PDF here
  NULL,
  1,
  true,
  3
);
```

**Child Page 1:**
```sql
INSERT INTO receipts (
  id,
  collection_id,
  vendor_name,            -- NULL or copy from parent
  total_amount,           -- NULL or 0
  file_path,
  parent_receipt_id,      -- Points to parent
  page_number,            -- 1
  is_parent,              -- false
  total_pages             -- 3 (copy from parent)
) VALUES (
  '22222222-2222-2111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  NULL,
  NULL,
  'receipts/222.../page_1.jpg',
  '22222222-2222-2222-2222-222222222222',
  1,
  false,
  3
);
```

**Child Page 2:**
```sql
INSERT INTO receipts (
  id,
  collection_id,
  vendor_name,
  total_amount,
  file_path,
  parent_receipt_id,
  page_number,            -- 2
  is_parent,
  total_pages
) VALUES (
  '22222222-2222-2222-2222-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  NULL,
  NULL,
  'receipts/222.../page_2.jpg',
  '22222222-2222-2222-2222-222222222222',
  2,
  false,
  3
);
```

**Child Page 3:**
```sql
INSERT INTO receipts (
  id,
  collection_id,
  vendor_name,
  total_amount,
  file_path,
  parent_receipt_id,
  page_number,            -- 3
  is_parent,
  total_pages
) VALUES (
  '22222222-2222-2222-3333-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  NULL,
  NULL,
  'receipts/222.../page_3.jpg',
  '22222222-2222-2222-2222-222222222222',
  3,
  false,
  3
);
```

---

### Query Examples

#### Get All Pages for a Receipt

```sql
-- Get all pages for receipt (using helper function)
SELECT * FROM get_receipt_pages('22222222-2222-2222-2222-222222222222');

-- Or manually:
SELECT id, page_number, file_path
FROM receipts
WHERE parent_receipt_id = '22222222-2222-2222-2222-222222222222'
  OR id = '22222222-2222-2222-2222-222222222222'
ORDER BY page_number;
```

#### Get Parent Receipt from Any Page

```sql
SELECT get_parent_receipt('22222222-2222-2222-3333-111111111111');
-- Returns: '22222222-2222-2222-2222-222222222222' (parent)
```

#### List All Multi-Page Receipts

```sql
SELECT
  id,
  vendor_name,
  total_amount,
  total_pages,
  created_at
FROM receipts
WHERE is_parent = true
ORDER BY created_at DESC;
```

#### Count Total Pages Across All Receipts

```sql
SELECT
  COUNT(*) FILTER (WHERE is_parent = true OR parent_receipt_id IS NULL) as total_receipts,
  SUM(CASE
    WHEN is_parent THEN total_pages
    WHEN parent_receipt_id IS NULL THEN 1
    ELSE 0
  END) as total_pages
FROM receipts;
```

---

## Implementation Plan

### Phase 1: Database Migration (Week 1)

**Tasks:**
1. ✅ Create and test migration locally
2. ✅ Add indexes for performance
3. ✅ Create helper functions
4. ✅ Test with sample data
5. ✅ Deploy to staging
6. ✅ Verify backward compatibility

**Testing Checklist:**
- [ ] Existing single-page receipts still work
- [ ] Can create multi-page receipt
- [ ] Queries return correct results
- [ ] RLS policies work correctly
- [ ] No performance degradation

---

### Phase 2: Backend API Updates (Week 1-2)

#### Update Receipt Creation Endpoint

**Current:** Upload single file → Create one receipt

**New:** Upload multiple files → Create parent + children

**TypeScript Interface:**
```typescript
interface ReceiptUploadRequest {
  files: File[];  // Changed from single File
  collectionId: string;
  // ... other fields
}

interface ReceiptUploadResponse {
  parentReceiptId: string;
  totalPages: number;
  pageIds: string[];
  extractionStatus: 'pending' | 'processing';
}
```

#### Update Storage Structure

**Old:**
```
receipts/
  {receipt_id}/
    file.jpg
    thumbnail.jpg
```

**New (Multi-Page):**
```
receipts/
  {parent_receipt_id}/
    page_1.jpg
    page_1_thumb.jpg
    page_2.jpg
    page_2_thumb.jpg
    page_3.jpg
    page_3_thumb.jpg
    combined.pdf (optional)
```

---

### Phase 3: Edge Function Updates (Week 2)

#### Update `extract-receipt-data` Function

**Current:** Extracts data from single image

**New Options:**

**Option A: Extract Each Page Separately**
```typescript
// Extract page 1 only (first page usually has totals)
async function extractPrimaryPage(imageUrl: string) {
  // Call OpenAI with first page only
  // Return: vendor, date, total, etc.
}

// Extract other pages (for itemized details)
async function extractAdditionalPages(imageUrls: string[]) {
  // Call OpenAI with remaining pages
  // Return: line items, notes, etc.
}
```

**Option B: Extract All Pages Together (RECOMMENDED)**
```typescript
async function extractMultiPageReceipt(imageUrls: string[]) {
  // Call OpenAI Vision with all images in one request
  // GPT-4 Vision supports multiple images (up to 10)

  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract receipt data from these images. This is a single receipt spanning multiple pages."
          },
          ...imageUrls.map(url => ({
            type: "image_url",
            image_url: { url }
          }))
        ]
      }
    ]
  });

  return parseExtractionResponse(response);
}
```

**Recommendation:** Option B (combined extraction)
- More accurate (GPT sees full context)
- Understands "page 1 of 3" indicators
- Can correlate data across pages
- Only 1 API call (cheaper)

---

### Phase 4: Frontend UI Components (Week 2-3)

#### 1. Multi-Page Upload Component

**New Component:** `MultiPageReceiptUpload.tsx`

```typescript
interface MultiPageReceiptUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  onClose: () => void;
}

export function MultiPageReceiptUpload({ onUpload, onClose }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFilesSelected = (selectedFiles: FileList) => {
    // Allow multiple files
    const fileArray = Array.from(selectedFiles);
    setFiles(fileArray);

    // Generate previews for each
    generatePreviews(fileArray);
  };

  return (
    <div>
      {/* Drag-and-drop area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        Drop multiple pages here or click to browse
      </div>

      {/* File input (with multiple attribute) */}
      <input
        type="file"
        multiple  // Key: allows multiple files
        accept="image/*,application/pdf"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* Preview all pages */}
      <div className="page-preview-grid">
        {previews.map((preview, index) => (
          <div key={index} className="page-preview">
            <img src={preview} alt={`Page ${index + 1}`} />
            <span>Page {index + 1}</span>
            <button onClick={() => removePage(index)}>
              <X />
            </button>
          </div>
        ))}
      </div>

      {/* Page reordering */}
      <div className="page-order-controls">
        <button onClick={movePageUp}>↑ Move Up</button>
        <button onClick={movePageDown}>↓ Move Down</button>
      </div>

      {/* Upload button */}
      <button
        onClick={() => onUpload(files)}
        disabled={files.length === 0}
      >
        Upload {files.length} {files.length === 1 ? 'Page' : 'Pages'}
      </button>
    </div>
  );
}
```

**Features:**
- ✅ Multiple file selection
- ✅ Drag-and-drop support
- ✅ Preview all pages before upload
- ✅ Reorder pages
- ✅ Remove individual pages
- ✅ Shows total page count

---

#### 2. Multi-Page Receipt Viewer

**New Component:** `MultiPageReceiptViewer.tsx`

```typescript
interface MultiPageReceiptViewerProps {
  receiptId: string;
}

export function MultiPageReceiptViewer({ receiptId }: Props) {
  const [pages, setPages] = useState<ReceiptPage[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');

  useEffect(() => {
    loadReceiptPages();
  }, [receiptId]);

  const loadReceiptPages = async () => {
    // Call helper function
    const { data } = await supabase.rpc('get_receipt_pages', {
      receipt_uuid: receiptId
    });
    setPages(data);
  };

  return (
    <div className="receipt-viewer">
      {/* View mode toggle */}
      <div className="view-mode-toggle">
        <button
          onClick={() => setViewMode('single')}
          className={viewMode === 'single' ? 'active' : ''}
        >
          Single Page
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={viewMode === 'all' ? 'active' : ''}
        >
          All Pages
        </button>
      </div>

      {viewMode === 'single' ? (
        <>
          {/* Single page view with navigation */}
          <div className="page-viewer">
            <img
              src={getSupabaseUrl(pages[currentPage - 1]?.file_path)}
              alt={`Page ${currentPage}`}
            />
          </div>

          {/* Page navigation */}
          <div className="page-navigation">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>

            <span>Page {currentPage} of {pages.length}</span>

            <button
              onClick={() => setCurrentPage(p => Math.min(pages.length, p + 1))}
              disabled={currentPage === pages.length}
            >
              Next →
            </button>
          </div>

          {/* Thumbnail strip */}
          <div className="thumbnail-strip">
            {pages.map((page, index) => (
              <img
                key={page.id}
                src={getSupabaseUrl(page.thumbnail_path)}
                alt={`Page ${index + 1}`}
                className={currentPage === index + 1 ? 'active' : ''}
                onClick={() => setCurrentPage(index + 1)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* All pages view (vertical scroll) */}
          <div className="all-pages-view">
            {pages.map((page, index) => (
              <div key={page.id} className="page-container">
                <div className="page-number">Page {index + 1}</div>
                <img
                  src={getSupabaseUrl(page.file_path)}
                  alt={`Page ${index + 1}`}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**Features:**
- ✅ Two view modes: single page or all pages
- ✅ Page navigation (prev/next)
- ✅ Thumbnail strip for quick navigation
- ✅ Current page indicator
- ✅ Responsive design

---

#### 3. Receipt List Updates

**Update:** `ReceiptsPage.tsx` to show page count

```typescript
// In receipt list item
<div className="receipt-card">
  <img src={thumbnailUrl} alt={vendor} />
  <div className="receipt-info">
    <h3>{vendor}</h3>
    <p>{date}</p>
    <p>${amount}</p>

    {/* NEW: Show page count badge */}
    {totalPages > 1 && (
      <span className="page-count-badge">
        📄 {totalPages} pages
      </span>
    )}
  </div>
</div>
```

---

### Phase 5: Testing & QA (Week 3)

**Test Cases:**

1. **Single-Page Receipt (Backward Compatibility)**
   - [ ] Upload single image
   - [ ] Verify receipt created with page_number = 1
   - [ ] Verify is_parent = false
   - [ ] Verify displays correctly in list and detail view

2. **Multi-Page Upload**
   - [ ] Upload 2-page receipt
   - [ ] Verify parent receipt created
   - [ ] Verify 2 child receipts created
   - [ ] Verify page_numbers are 1 and 2
   - [ ] Verify parent has is_parent = true

3. **Multi-Page Viewing**
   - [ ] Open multi-page receipt
   - [ ] Navigate between pages
   - [ ] Switch between single/all view modes
   - [ ] Verify thumbnails clickable

4. **Extraction**
   - [ ] Upload multi-page receipt
   - [ ] Verify extraction runs on all pages
   - [ ] Verify extracted data combines correctly
   - [ ] Verify total amount correct

5. **Export**
   - [ ] Multi-page receipt in CSV export (shows as 1 entry)
   - [ ] Multi-page receipt in PDF report (shows all pages)
   - [ ] Business export includes all pages

6. **Deletion**
   - [ ] Delete parent receipt
   - [ ] Verify all child pages deleted (CASCADE)
   - [ ] Verify storage files deleted

7. **Editing**
   - [ ] Edit vendor name on parent
   - [ ] Verify changes reflected in list
   - [ ] Individual pages don't need editing (metadata on parent only)

---

## UI/UX Design

### Upload Flow

**Option 1: Single Upload Button (Recommended)**

```
┌────────────────────────────────────────┐
│  Upload Receipt                        │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │                                  │ │
│  │    📷  Drop files here           │ │
│  │                                  │ │
│  │    or click to browse            │ │
│  │                                  │ │
│  │  Supports: JPG, PNG, PDF         │ │
│  │  Multiple pages: Select all at   │ │
│  │  once or drag & drop             │ │
│  │                                  │ │
│  └──────────────────────────────────┘ │
│                                        │
│  [ Browse Files ]  [ Take Photo ]     │
│                                        │
└────────────────────────────────────────┘
```

**After Files Selected:**

```
┌────────────────────────────────────────┐
│  Receipt Pages (3)             [✕ Close]│
│                                        │
│  ┌─────┐  ┌─────┐  ┌─────┐           │
│  │     │  │     │  │     │           │
│  │ P1  │  │ P2  │  │ P3  │           │
│  │     │  │     │  │     │           │
│  └─────┘  └─────┘  └─────┘           │
│   ↑↓ ✕     ↑↓ ✕     ↑↓ ✕             │
│                                        │
│  ✓ All pages are from the same receipt│
│                                        │
│  [ Add More Pages ]                    │
│                                        │
│  [ Cancel ]        [ Upload 3 Pages ]  │
│                                        │
└────────────────────────────────────────┘
```

---

### Viewing Multi-Page Receipts

**Receipt Detail View:**

```
┌──────────────────────────────────────────┐
│ ← Back                                    │
│                                           │
│ Marriott Hotel Invoice                   │
│ March 15, 2025 • $456.78                 │
│                                           │
│ ┌────────┐  ┌──────────────────────┐    │
│ │ Single │  │       All Pages      │    │
│ └────────┘  └──────────────────────┘    │
│                                           │
│ ┌───────────────────────────────────┐   │
│ │                                   │   │
│ │         [Receipt Image]           │   │
│ │                                   │   │
│ │         Page 1 of 3               │   │
│ │                                   │   │
│ └───────────────────────────────────┘   │
│                                           │
│ [ ← Previous ]  Page 1 of 3  [ Next → ]  │
│                                           │
│ ┌────┐ ┌────┐ ┌────┐                    │
│ │ P1 │ │ P2 │ │ P3 │  ← Thumbnails       │
│ └────┘ └────┘ └────┘                    │
│   ▲                                       │
│ active                                    │
│                                           │
│ Vendor: Marriott Hotel                   │
│ Date: March 15, 2025                     │
│ Amount: $456.78                          │
│ Category: Lodging                        │
│                                           │
│ [ Edit ] [ Download All ] [ Delete ]     │
│                                           │
└──────────────────────────────────────────┘
```

---

### Receipt List View

```
┌──────────────────────────────────────────┐
│ Receipts                                  │
│                                           │
│ ┌────────────────────────────────────┐   │
│ │ 📷    Marriott Hotel       $456.78 │   │
│ │       March 15, 2025               │   │
│ │       📄 3 pages                   │◄──│ Badge
│ └────────────────────────────────────┘   │
│                                           │
│ ┌────────────────────────────────────┐   │
│ │ 📷    Starbucks             $12.50 │   │
│ │       March 14, 2025               │   │
│ └────────────────────────────────────┘   │ No badge (single page)
│                                           │
│ ┌────────────────────────────────────┐   │
│ │ 📷    Home Depot           $234.56 │   │
│ │       March 13, 2025               │   │
│ │       📄 2 pages                   │   │
│ └────────────────────────────────────┘   │
│                                           │
└──────────────────────────────────────────┘
```

---

## Technical Considerations

### 1. File Size Limits

**Current:** 10 MB per file (Supabase Storage default)

**Multi-Page Considerations:**
- 3 pages × 5 MB each = 15 MB total
- Need to check combined size before upload
- May need to increase limit or add compression

**Recommendation:**
```typescript
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB total
const MAX_PAGES = 10; // Reasonable limit

function validateMultiPageUpload(files: File[]): string | null {
  if (files.length > MAX_PAGES) {
    return `Maximum ${MAX_PAGES} pages allowed`;
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return `Total size exceeds 50 MB limit`;
  }

  return null; // Valid
}
```

---

### 2. Extraction Cost

**Current:** $0.01 per image (GPT-4 Vision)

**Multi-Page:**
- Option A: Extract each page separately = 3 × $0.01 = $0.03
- Option B: Extract all pages together = 1 × $0.01 = $0.01 ✅

**Recommendation:** Use combined extraction (Option B)
- Same cost as single page
- Better accuracy (full context)
- Faster (one API call)

---

### 3. Performance

**Database Queries:**
```sql
-- Get receipt with pages (efficient with indexes)
SELECT * FROM receipts
WHERE id = $1 OR parent_receipt_id = $1
ORDER BY page_number;

-- Uses index: idx_receipts_parent_id
-- Query time: ~5ms for 10 pages
```

**Storage:**
- Each page stored separately
- Thumbnails generated for each
- Download all pages: multiple HTTP requests (can optimize with ZIP)

---

### 4. PDF Handling

**Current:** PDF converted to image (first page only)

**Multi-Page PDF:**
```typescript
async function convertMultiPagePdfToImages(pdfFile: File): Promise<File[]> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const images: File[] = [];

  // Convert each page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    const viewport = page.getViewport({ scale: 2 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png', 0.95);
    });

    const imageFile = new File(
      [blob],
      `${pdfFile.name}_page_${i}.png`,
      { type: 'image/png' }
    );

    images.push(imageFile);
  }

  return images;
}
```

---

### 5. Backward Compatibility

**Ensure existing code continues to work:**

```typescript
// OLD: Receipts page query
const { data: receipts } = await supabase
  .from('receipts')
  .select('*')
  .eq('collection_id', collectionId);

// Still works! Returns all receipts (parents and children)
// To get only "logical" receipts (excluding children):

const { data: receipts } = await supabase
  .from('receipts')
  .select('*')
  .eq('collection_id', collectionId)
  .or('is_parent.eq.true,parent_receipt_id.is.null'); // Only parents or singles
```

---

## Cost Analysis

### Development Cost

**Estimated Hours:**
- Database migration: 4 hours
- Backend API updates: 8 hours
- Edge Function updates: 6 hours
- Frontend components: 16 hours
- Testing & QA: 8 hours
- **Total:** ~42 hours (~1 week for 1 developer)

**Hourly Rate:** $100/hour (average)
**Total Cost:** $4,200

---

### Operational Cost

**Storage:**
- Multi-page receipts use more storage
- 3-page receipt = 3× storage cost
- Estimate: +20% storage costs overall

**API Costs (OpenAI):**
- Using combined extraction: **No increase**
- Still $0.01 per receipt (regardless of pages)

**Database:**
- Negligible (few extra rows)

**Total Increase:** ~$5-10/month for typical usage

---

## Alternative Approaches

### Alternative 1: PDF Merging

**Concept:** Combine all pages into single PDF before upload

**Pros:**
- ✅ Simpler database (no changes needed)
- ✅ One file per receipt

**Cons:**
- ❌ Can't view individual pages easily
- ❌ Harder to extract data (PDF text vs images)
- ❌ Can't reorder pages after upload

**Verdict:** ❌ Not recommended (less flexible)

---

### Alternative 2: External Links

**Concept:** Store multi-page receipts in Google Drive, link to them

**Pros:**
- ✅ No storage cost increase
- ✅ Unlimited pages

**Cons:**
- ❌ Requires Google Drive integration
- ❌ No extraction (external files)
- ❌ Complex permissions
- ❌ Poor UX (leaves app)

**Verdict:** ❌ Not recommended (too complex)

---

### Alternative 3: Image Stitching

**Concept:** Combine multiple pages into one tall image

**Pros:**
- ✅ One file per receipt
- ✅ No schema changes

**Cons:**
- ❌ Very large images (performance issues)
- ❌ Can't navigate pages individually
- ❌ Extraction accuracy may suffer

**Verdict:** ❌ Not recommended (poor UX)

---

## Rollout Strategy

### Phase 1: Soft Launch (Week 4)

**Target:** Internal testing + beta users (10-20 users)

**Steps:**
1. Deploy to staging
2. Invite beta testers
3. Monitor for issues
4. Gather feedback

**Success Criteria:**
- No critical bugs
- Positive user feedback
- Extraction accuracy ≥ 90%

---

### Phase 2: Gradual Rollout (Week 5-6)

**Target:** 25% of users, then 50%, then 100%

**Feature Flag:**
```typescript
const ENABLE_MULTIPAGE =
  import.meta.env.VITE_ENABLE_MULTIPAGE_RECEIPTS === 'true';

// In upload component:
if (ENABLE_MULTIPAGE) {
  return <MultiPageReceiptUpload />;
} else {
  return <ReceiptUpload />; // Legacy
}
```

**Monitoring:**
- Track multi-page upload success rate
- Monitor extraction failures
- Watch for storage issues

---

### Phase 3: Full Release (Week 7)

**Announcement:**
- Email to all users
- In-app notification
- Blog post / changelog

**Documentation:**
- Help article: "How to upload multi-page receipts"
- Video tutorial
- FAQ section

---

## Next Steps

### Immediate Actions

1. **Review and approve this design document**
2. **Create GitHub issue for tracking**
3. **Add to sprint planning**

### Before Implementation

1. **User Research:**
   - Survey: How often do users have multi-page receipts?
   - What's the average number of pages?
   - What industries need this most?

2. **Technical Spike:**
   - Test GPT-4 Vision with 5-page receipt
   - Verify extraction accuracy
   - Measure performance impact

3. **Prioritization:**
   - Compare to other feature requests
   - Estimate ROI (user satisfaction vs development cost)

---

## Conclusion

**Multi-page receipt support is:**
- ✅ Technically feasible with minimal schema changes
- ✅ Backward compatible with existing receipts
- ✅ Valuable for user experience (eliminates pain point)
- ✅ Cost-effective (no significant operational cost increase)
- ✅ Reasonable development effort (~1 week)

**Recommended Action:** Proceed with implementation using the parent-child model approach.

**Priority:** 🟡 Medium - Should implement after critical features, but before "nice-to-have" enhancements.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-11
**Maintained By:** Product & Engineering Team
