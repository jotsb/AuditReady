# Camera-Based Multi-Page Receipt Capture - Implementation Guide

**Last Updated:** 2025-10-12
**Status:** Design Document
**Priority:** 🟢 High - Critical for mobile UX

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [User Scenarios](#user-scenarios)
3. [Solution Design](#solution-design)
4. [UI/UX Flow](#uiux-flow)
5. [Implementation Details](#implementation-details)
6. [Database Integration](#database-integration)
7. [Mobile Considerations](#mobile-considerations)
8. [Testing Strategy](#testing-strategy)
9. [Alternative Approaches](#alternative-approaches)

---

## Problem Statement

### The Real-World Scenario

**User has a physical multi-page receipt:**
- 📄 Double-sided receipt (front and back)
- 📄 2-3 page restaurant bill
- 📄 Long itemized invoice on multiple sheets
- 📄 Hotel receipt with breakdown across pages

**Current System Problem:**
```
User opens app → Clicks "Take Photo" →
Takes photo of page 1 → Receipt uploaded →
❌ What about page 2? User must:
  - Create separate receipt entry
  - Upload page 2 as "new" receipt
  - Result: Same receipt appears twice in system
```

**User Pain Points:**
- "I took a photo of page 1, now what?"
- "How do I add the back side?"
- "The app uploaded before I could add page 2"
- "I have to create a new receipt for each page"
- "My reports show duplicate receipts"

---

## User Scenarios

### Scenario 1: Double-Sided Receipt
```
User at coffee shop counter
Receipt: Front = itemized list, Back = payment details
Action: Flip receipt, take 2 photos
Expected: System treats as ONE receipt with 2 pages
```

### Scenario 2: Restaurant Bill (3 pages)
```
User finishes dinner
Receipt: Page 1 = food items, Page 2 = drinks, Page 3 = tip + total
Action: Take 3 photos in sequence
Expected: System treats as ONE receipt with 3 pages
```

### Scenario 3: Hotel Invoice
```
User checks out of hotel
Receipt: Page 1 = room charges, Page 2 = mini-bar, Page 3 = services
Action: Take photos of each page
Expected: All pages grouped together
```

### Scenario 4: Mistake Recovery
```
User takes photo of page 1
Realizes it's blurry
Expected: Can retake page 1 before moving to page 2
```

---

## Solution Design

### Core Concept: Progressive Capture Mode

**Flow:**
```
User clicks "Take Photo" →
📸 Take photo of Page 1 →
✓ Preview appears →
User chooses:
  → "Add Another Page" (take page 2)
  → "Done" (single page receipt)
  → "Retake" (redo page 1)

If "Add Another Page":
📸 Take photo of Page 2 →
✓ Preview appears (shows page 1 + page 2) →
User chooses:
  → "Add Another Page" (take page 3)
  → "Done" (2-page receipt)
  → "Remove Last" (delete page 2)

Continue until user clicks "Done" →
Upload all pages as ONE receipt
```

### Key Features

1. **Progressive Capture**
   - User stays in "capture mode" until done
   - Each page adds to collection
   - Can review all pages before uploading

2. **Visual Feedback**
   - Show thumbnails of all captured pages
   - Current page count: "Page 2 of 3"
   - Clear "Add Another Page" button

3. **Editing Controls**
   - Retake current page
   - Remove last page
   - Reorder pages (drag & drop thumbnails)

4. **Smart Upload**
   - Only uploads when user clicks "Done"
   - All pages uploaded together
   - Creates parent + child records atomically

---

## UI/UX Flow

### Step 1: Initial Capture

```
┌─────────────────────────────────────┐
│  📷 Take Receipt Photo              │
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │    [Camera viewfinder]        │ │
│  │                               │ │
│  │                               │ │
│  │                               │ │
│  │         ( )  Take Photo       │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  💡 Tip: Make sure receipt is      │
│     clear and well-lit              │
│                                     │
│  [ Cancel ]                         │
└─────────────────────────────────────┘
```

---

### Step 2: Page Preview & Options

```
┌─────────────────────────────────────┐
│  Page 1 Captured                    │
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │   [Preview of captured page]  │ │
│  │                               │ │
│  │         ✓ Page 1              │ │
│  └───────────────────────────────┘ │
│                                     │
│  📄 Is this receipt multi-page?    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  ✓ Done (Single Page)       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  + Add Another Page          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  ↻ Retake This Page          │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ Cancel ]                         │
└─────────────────────────────────────┘
```

---

### Step 3: Capturing Additional Pages

```
┌─────────────────────────────────────┐
│  📷 Capture Page 2                  │
│                                     │
│  Captured Pages: ┌───┐             │
│                  │ 1 │             │
│                  └───┘             │
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │    [Camera viewfinder]        │ │
│  │                               │ │
│  │                               │ │
│  │                               │ │
│  │         ( )  Take Photo       │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  💡 Position page 2 clearly         │
│                                     │
│  [ ← Back ]              [ Cancel ] │
└─────────────────────────────────────┘
```

---

### Step 4: Multi-Page Preview

```
┌─────────────────────────────────────┐
│  📄 Receipt Preview (3 Pages)       │
│                                     │
│  ┌───┐  ┌───┐  ┌───┐              │
│  │   │  │   │  │   │              │
│  │ 1 │  │ 2 │  │ 3 │              │
│  │   │  │   │  │   │              │
│  └───┘  └───┘  └───┘              │
│   ✓      ✓      ✓                  │
│                                     │
│  Drag to reorder pages              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  + Add Another Page          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🗑️ Remove Last Page         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  ✓ Upload 3 Pages            │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ Cancel ]                         │
└─────────────────────────────────────┘
```

---

### Step 5: Uploading Progress

```
┌─────────────────────────────────────┐
│  Uploading Receipt...               │
│                                     │
│  ┌───┐  ┌───┐  ┌───┐              │
│  │ 1 │  │ 2 │  │ 3 │              │
│  └───┘  └───┘  └───┘              │
│   ✓      ✓      ⏳                  │
│                                     │
│  ████████████░░░░░░░░░  65%        │
│                                     │
│  Uploading page 3 of 3...           │
│                                     │
│  Please wait...                     │
│                                     │
└─────────────────────────────────────┘
```

---

### Step 6: Success

```
┌─────────────────────────────────────┐
│  ✅ Receipt Uploaded Successfully!  │
│                                     │
│  📄 3-page receipt saved            │
│                                     │
│  Vendor: [Extracting...]            │
│  Amount: [Extracting...]            │
│  Date:   [Extracting...]            │
│                                     │
│  🤖 AI is extracting receipt data   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  View Receipt                │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Take Another Receipt        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

## Implementation Details

### Component Structure

```
src/components/receipts/
  ├── MultiPageCameraCapture.tsx   (NEW - Main component)
  ├── CameraPreview.tsx             (NEW - Camera viewfinder)
  ├── PageThumbnailStrip.tsx        (NEW - Thumbnail carousel)
  └── ReceiptUpload.tsx             (Updated - Add multi-page option)
```

### MultiPageCameraCapture Component

```typescript
import { useState, useRef } from 'react';
import { Camera, Plus, Check, X, RotateCcw, Trash2 } from 'lucide-react';

interface CapturedPage {
  id: string;
  file: File;
  thumbnail: File;
  preview: string;
  pageNumber: number;
}

interface MultiPageCameraCaptureProps {
  onComplete: (pages: CapturedPage[]) => Promise<void>;
  onCancel: () => void;
}

export function MultiPageCameraCapture({ onComplete, onCancel }: MultiPageCameraCaptureProps) {
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  const [currentMode, setCurrentMode] = useState<'capture' | 'preview' | 'review'>('capture');
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger camera
  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  // Handle photo captured
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optimize image
    const optimized = await optimizeImage(file);

    // Create preview
    const preview = await createPreviewUrl(optimized.full);

    setCurrentPreview(preview);
    setCurrentMode('preview');

    // Store temporarily (not added to pages yet)
    tempCapturedPage = {
      id: crypto.randomUUID(),
      file: optimized.full,
      thumbnail: optimized.thumbnail,
      preview,
      pageNumber: capturedPages.length + 1
    };
  };

  // User confirms this page
  const handleConfirmPage = () => {
    setCapturedPages([...capturedPages, tempCapturedPage]);
    setCurrentPreview(null);
    setCurrentMode('review');
  };

  // User wants to retake current page
  const handleRetakePage = () => {
    setCurrentPreview(null);
    setCurrentMode('capture');
    triggerCamera();
  };

  // User wants to add another page
  const handleAddAnotherPage = () => {
    setCurrentMode('capture');
    triggerCamera();
  };

  // User wants to remove last page
  const handleRemoveLastPage = () => {
    setCapturedPages(capturedPages.slice(0, -1));
    if (capturedPages.length === 1) {
      setCurrentMode('capture');
    }
  };

  // User is done, upload all pages
  const handleComplete = async () => {
    if (capturedPages.length === 0) return;

    setUploading(true);
    try {
      await onComplete(capturedPages);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Render based on current mode
  if (currentMode === 'capture') {
    return (
      <div className="multi-page-capture">
        <div className="capture-header">
          <h2>Capture Page {capturedPages.length + 1}</h2>
          {capturedPages.length > 0 && (
            <div className="captured-count">
              {capturedPages.length} {capturedPages.length === 1 ? 'page' : 'pages'} captured
            </div>
          )}
        </div>

        {/* Camera input (hidden, triggered programmatically) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoCapture}
          className="hidden"
        />

        {/* Camera button */}
        <button
          onClick={triggerCamera}
          className="camera-trigger-button"
        >
          <Camera size={64} />
          <span>Take Photo</span>
        </button>

        {/* Show thumbnails of captured pages */}
        {capturedPages.length > 0 && (
          <div className="captured-pages-strip">
            {capturedPages.map((page, index) => (
              <img
                key={page.id}
                src={page.preview}
                alt={`Page ${index + 1}`}
                className="page-thumbnail"
              />
            ))}
          </div>
        )}

        <div className="capture-actions">
          {capturedPages.length > 0 && (
            <button onClick={handleComplete} className="btn-primary">
              <Check size={20} />
              Done ({capturedPages.length} {capturedPages.length === 1 ? 'page' : 'pages'})
            </button>
          )}
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (currentMode === 'preview') {
    return (
      <div className="page-preview">
        <div className="preview-header">
          <h2>Page {capturedPages.length + 1} Preview</h2>
        </div>

        {/* Preview image */}
        <div className="preview-image-container">
          <img src={currentPreview} alt="Preview" />
        </div>

        {/* Actions */}
        <div className="preview-actions">
          <button onClick={handleConfirmPage} className="btn-primary">
            <Check size={20} />
            Looks Good
          </button>
          <button onClick={handleRetakePage} className="btn-secondary">
            <RotateCcw size={20} />
            Retake
          </button>
        </div>

        {/* Info */}
        <div className="preview-info">
          <p>Is this receipt multi-page?</p>
          <p className="text-sm text-gray-500">
            You can add more pages after confirming this one.
          </p>
        </div>
      </div>
    );
  }

  if (currentMode === 'review') {
    return (
      <div className="pages-review">
        <div className="review-header">
          <h2>Receipt Pages ({capturedPages.length})</h2>
        </div>

        {/* All captured pages */}
        <div className="pages-grid">
          {capturedPages.map((page, index) => (
            <div key={page.id} className="page-card">
              <img src={page.preview} alt={`Page ${index + 1}`} />
              <div className="page-number">Page {index + 1}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="review-actions">
          <button onClick={handleAddAnotherPage} className="btn-secondary">
            <Plus size={20} />
            Add Another Page
          </button>

          {capturedPages.length > 1 && (
            <button onClick={handleRemoveLastPage} className="btn-secondary">
              <Trash2 size={20} />
              Remove Last Page
            </button>
          )}

          <button
            onClick={handleComplete}
            className="btn-primary"
            disabled={uploading}
          >
            {uploading ? (
              <>Uploading...</>
            ) : (
              <>
                <Check size={20} />
                Upload {capturedPages.length} {capturedPages.length === 1 ? 'Page' : 'Pages'}
              </>
            )}
          </button>
        </div>

        <button onClick={onCancel} className="btn-text">
          Cancel
        </button>
      </div>
    );
  }

  return null;
}
```

---

### Key Implementation Details

#### 1. Camera Input

```typescript
// Use native camera API (works on mobile)
<input
  type="file"
  accept="image/*"
  capture="environment"  // Use back camera on mobile
  onChange={handlePhotoCapture}
/>
```

**Benefits:**
- ✅ Uses native camera app on mobile
- ✅ Works on iOS and Android
- ✅ No permissions needed (user grants via file picker)
- ✅ Photos saved to device first (user control)

---

#### 2. State Management

```typescript
// States for capture flow
const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
const [currentMode, setCurrentMode] = useState<
  'capture' |   // Taking photo
  'preview' |   // Reviewing current photo
  'review'      // Reviewing all pages
>('capture');

// Temporary storage for current photo (before confirmation)
let tempCapturedPage: CapturedPage | null = null;
```

---

#### 3. Upload Flow

```typescript
const handleComplete = async (pages: CapturedPage[]) => {
  // Step 1: Generate parent receipt ID
  const parentReceiptId = crypto.randomUUID();

  // Step 2: Upload all pages to storage
  const uploadPromises = pages.map(async (page, index) => {
    const filePath = `receipts/${parentReceiptId}/page_${index + 1}.jpg`;
    const thumbPath = `receipts/${parentReceiptId}/page_${index + 1}_thumb.jpg`;

    // Upload full image
    await supabase.storage
      .from('receipts')
      .upload(filePath, page.file);

    // Upload thumbnail
    await supabase.storage
      .from('receipts')
      .upload(thumbPath, page.thumbnail);

    return { filePath, thumbPath };
  });

  const uploadedPaths = await Promise.all(uploadPromises);

  // Step 3: Create parent receipt record
  const { data: parentReceipt } = await supabase
    .from('receipts')
    .insert({
      id: parentReceiptId,
      collection_id: currentCollectionId,
      uploaded_by: userId,
      is_parent: true,
      total_pages: pages.length,
      extraction_status: 'pending'
    })
    .select()
    .single();

  // Step 4: Create child page records
  const childRecords = uploadedPaths.map((paths, index) => ({
    collection_id: currentCollectionId,
    uploaded_by: userId,
    parent_receipt_id: parentReceiptId,
    page_number: index + 1,
    file_path: paths.filePath,
    thumbnail_path: paths.thumbPath,
    is_parent: false,
    total_pages: pages.length
  }));

  await supabase
    .from('receipts')
    .insert(childRecords);

  // Step 5: Trigger extraction (all pages together)
  await supabase.functions.invoke('extract-receipt-data', {
    body: {
      receiptId: parentReceiptId,
      imagePaths: uploadedPaths.map(p => p.filePath)
    }
  });

  // Done!
  return parentReceipt;
};
```

---

## Database Integration

### Uses Existing Schema (from MULTI_PAGE_RECEIPTS.md)

**Tables:**
- `receipts` - Already has `parent_receipt_id`, `page_number`, `is_parent`, `total_pages`

**Flow:**
1. User captures 3 pages
2. System uploads all 3 images
3. Creates parent receipt: `is_parent=true, total_pages=3`
4. Creates 3 child receipts: `parent_receipt_id=PARENT_ID, page_number=1/2/3`
5. Triggers extraction with all 3 image URLs

**No additional schema changes needed!** ✅

---

## Mobile Considerations

### 1. Camera Orientation

```typescript
// Detect if user is holding phone in portrait/landscape
const handleOrientationChange = () => {
  const orientation = window.screen.orientation?.type;
  // Adjust UI accordingly
};
```

### 2. Photo Quality

```typescript
// Optimize for mobile upload (reduce size, compress)
const optimizeForMobile = async (file: File) => {
  // Target: 1-2 MB per image
  // Resolution: Max 1920x1080 (good enough for OCR)
  return await optimizeImage(file, {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.85
  });
};
```

### 3. Offline Support (Future)

```typescript
// Cache captured pages locally
const cachePages = async (pages: CapturedPage[]) => {
  // Use IndexedDB or localStorage
  await localforage.setItem('pending-receipt', {
    pages,
    timestamp: Date.now()
  });
};

// Upload when back online
const uploadCachedPages = async () => {
  const cached = await localforage.getItem('pending-receipt');
  if (cached) {
    await handleComplete(cached.pages);
    await localforage.removeItem('pending-receipt');
  }
};
```

---

## Testing Strategy

### Manual Testing Checklist

**Single Page:**
- [ ] Take 1 photo → Click "Done" → Uploads as single-page receipt

**Multi-Page:**
- [ ] Take 2 photos → Click "Done" → Creates 2-page receipt
- [ ] Take 3 photos → Click "Done" → Creates 3-page receipt
- [ ] Take 5 photos → Click "Done" → Creates 5-page receipt

**Retake:**
- [ ] Take photo → Click "Retake" → Can take again
- [ ] New photo replaces old one

**Remove Last:**
- [ ] Take 3 photos → "Remove Last" → Now 2 pages
- [ ] Can remove down to 0 pages → Back to capture mode

**Cancel:**
- [ ] Take 2 photos → Click "Cancel" → No receipt created
- [ ] All images discarded

**Upload Progress:**
- [ ] Shows progress bar during upload
- [ ] Shows which page is uploading (1 of 3, 2 of 3...)
- [ ] Success message after upload

**Extraction:**
- [ ] Multi-page receipt triggers extraction
- [ ] All pages sent to OpenAI together
- [ ] Extracted data appears correctly

---

## Alternative Approaches

### Alternative 1: Manual "Multi-Page Mode" Toggle

**Concept:** User explicitly enables "multi-page mode" before capturing

```
[ ] Single Page (default)
[✓] Multi-Page Mode

If multi-page checked:
  → Stays in capture mode after each photo
  → Must click "Done" to finish
```

**Pros:**
- ✅ Clear intent from user

**Cons:**
- ❌ Extra step (friction)
- ❌ User must decide before seeing receipt

**Verdict:** ❌ Not recommended (worse UX)

---

### Alternative 2: Auto-Detect Multi-Page

**Concept:** AI detects "Page 1 of 3" text and prompts for more pages

```
User takes photo →
AI sees "Page 1 of 2" →
System prompts: "Would you like to capture page 2?"
```

**Pros:**
- ✅ Smart/automatic

**Cons:**
- ❌ Unreliable (many receipts don't have page numbers)
- ❌ Delays upload (must wait for AI analysis)
- ❌ Expensive (extra API call just to detect)

**Verdict:** ❌ Not recommended (unreliable)

---

### Alternative 3: Post-Upload Page Addition

**Concept:** Upload single page, then add more pages later

```
Upload page 1 as receipt →
Receipt appears in list →
User clicks "Add Pages" →
Takes photos of remaining pages →
Pages attached to existing receipt
```

**Pros:**
- ✅ Flexible (can add pages later)

**Cons:**
- ❌ Complex UX (must find receipt again)
- ❌ Confusing (receipt already "exists")
- ❌ Extraction must re-run

**Verdict:** ❌ Not recommended (confusing)

---

## Recommended Approach Summary

✅ **Progressive Capture Mode** (Option 1 from Solution Design)

**Why it wins:**
1. ✅ **Intuitive:** Natural flow matches user's mental model
2. ✅ **Flexible:** Works for single OR multi-page seamlessly
3. ✅ **Forgiving:** Can retake, remove, reorder
4. ✅ **Fast:** All pages uploaded together (efficient)
5. ✅ **Mobile-friendly:** Uses native camera, minimal taps

**User Journey:**
```
📸 Take photo → ✓ Review → ➕ Add another? → 📸 Take photo → ✓ Review → ✓ Done
```

**Key Success Factors:**
- Clear visual feedback (thumbnails)
- Obvious "Add Another Page" button
- Easy to "just finish" with single page
- Can't accidentally upload before ready

---

## Implementation Priority

### Phase 1: Core Functionality (Week 1)
- ✅ Multi-page capture component
- ✅ Preview and confirm flow
- ✅ Thumbnail strip
- ✅ Basic upload (all pages)

### Phase 2: Enhanced UX (Week 2)
- ✅ Retake functionality
- ✅ Remove last page
- ✅ Upload progress indicator
- ✅ Success/error messaging

### Phase 3: Advanced Features (Week 3)
- ✅ Reorder pages (drag & drop)
- ✅ Offline caching
- ✅ Photo quality optimization
- ✅ Orientation handling

---

## Success Metrics

**Measure after launch:**
- % of receipts that are multi-page (expect 15-25%)
- Average pages per multi-page receipt (expect 2-3)
- User completion rate (target: >90%)
- Time to capture multi-page receipt (target: <60 seconds)
- Extraction accuracy for multi-page (target: >85%)

---

## Conclusion

**Camera-based multi-page receipt capture is:**
- ✅ Critical for mobile users
- ✅ Intuitive with progressive capture flow
- ✅ Technically feasible with existing schema
- ✅ Low risk (uses proven patterns)
- ✅ High impact (eliminates major pain point)

**Recommended:** Implement as **high priority** mobile feature.

**Estimated Effort:** 2-3 weeks for full implementation.

**Expected Impact:**
- Reduce duplicate receipt entries by 80%
- Improve mobile user satisfaction by 40%
- Increase receipt capture completion rate by 25%

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Maintained By:** Product & Engineering Team
