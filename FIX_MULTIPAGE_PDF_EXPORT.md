# Fix: Multipage Receipts Missing from PDF Export

## Problem

When exporting receipts to PDF report, multipage receipts would appear in the table but their images were skipped/missing from the image section of the report.

**Affected:** Both Bolt Cloud and self-hosted deployments

## Root Cause

The PDF export query only fetches parent receipts (`parent_receipt_id IS NULL`):
```typescript
.is('parent_receipt_id', null)
```

For multipage receipts:
- **Parent receipt**: Has no `file_path` (it's just metadata)
- **Child receipts**: Each page has its own `file_path`

The code was trying to download `receipt.file_path` from the parent receipt, which was `null`, so no images were downloaded for multipage receipts.

## Solution

Updated `src/components/reports/PDFExportReport.tsx` to:

1. **Detect multipage receipts**: Check if parent receipt has no `file_path`
2. **Fetch child pages**: Query for all child receipts by `parent_receipt_id`
3. **Download all pages**: Download each page's image in order
4. **Label pages**: Show "Receipt #X - Page Y of Z" in the PDF

### Code Changes

**Before:**
```typescript
if (receipt.file_path) {
  const { data } = await supabase.storage
    .from('receipts')
    .download(receipt.file_path);
  // ...
}
```

**After:**
```typescript
let pages: { filePath: string; pageNumber: number }[] = [];

if (receipt.file_path) {
  // Single page receipt
  pages.push({ filePath: receipt.file_path, pageNumber: 1 });
} else {
  // Multipage receipt - fetch all child pages
  const { data: childPages } = await supabase
    .from('receipts')
    .select('file_path, page_number')
    .eq('parent_receipt_id', receipt.id)
    .order('page_number', { ascending: true });

  pages = childPages.map(page => ({
    filePath: page.file_path,
    pageNumber: page.page_number
  }));
}

// Download all pages
for (const page of pages) {
  // Download and add to PDF
}
```

## What Changed

### Single Page Receipts
- **Before:** "Receipt #1"
- **After:** "Receipt #1" (unchanged)

### Multipage Receipts
- **Before:** Receipt shown in table, but NO images in PDF
- **After:** Receipt shown in table, ALL pages shown with labels:
  - "Receipt #2 - Page 1 of 3"
  - "Receipt #2 - Page 2 of 3"
  - "Receipt #2 - Page 3 of 3"

## Testing

1. Create a multipage receipt (3+ pages)
2. Go to **Reports > Export to PDF**
3. Enable "Include receipt images"
4. Click "Generate PDF"
5. Verify all pages appear in the PDF with correct labels

## Benefits

- ✅ All receipt pages now appear in PDF exports
- ✅ Clear page labeling for multipage receipts
- ✅ Pages appear in correct order
- ✅ Works for both single and multipage receipts
- ✅ Applied to both Bolt Cloud and self-hosted

## Files Changed

- `src/components/reports/PDFExportReport.tsx`

## Deployment

No database changes required. Just deploy the updated frontend code.

**Bolt Cloud:** Already deployed
**Self-Hosted:** Deploy updated `dist/` folder to your server
