# Comprehensive Performance Optimization Plan

**Date:** 2025-10-16
**Application:** Audit Proof Receipt Management System
**Current Bundle Size:** 457.61 KB gzipped (1,709.65 KB uncompressed)

## Executive Summary

This document outlines a comprehensive, end-to-end performance optimization strategy for the Audit Proof application, covering frontend rendering, database queries, API calls, bundle size, image handling, and browser optimizations. Each optimization includes implementation details and critical watch-outs to prevent breaking changes.

---

## Table of Contents

1. [Frontend Performance](#1-frontend-performance)
2. [Database & Query Optimization](#2-database--query-optimization)
3. [API & Network Optimization](#3-api--network-optimization)
4. [Bundle Size & Code Splitting](#4-bundle-size--code-splitting)
5. [Image & Media Optimization](#5-image--media-optimization)
6. [Caching Strategy](#6-caching-strategy)
7. [Browser Performance](#7-browser-performance)
8. [Implementation Priority Matrix](#8-implementation-priority-matrix)

---

## 1. Frontend Performance

### 1.1 React Component Optimization

#### Issue: Unnecessary Re-renders
**Current State:** Components re-render even when props/state haven't changed.
- 67 components with useState/useEffect (516 hook instances)
- No React.memo usage detected
- No useMemo/useCallback optimization in most components

**Optimization:**
```typescript
// Add memoization to expensive components
export const ReceiptThumbnail = React.memo(({ receipt, onClick }) => {
  // component logic
}, (prevProps, nextProps) => {
  return prevProps.receipt.id === nextProps.receipt.id &&
         prevProps.receipt.thumbnail_path === nextProps.receipt.thumbnail_path;
});

// Use useCallback for event handlers passed to children
const handleDelete = useCallback((id: string) => {
  // delete logic
}, [dependencies]);

// Use useMemo for expensive calculations
const filteredReceipts = useMemo(() => {
  return receipts.filter(r => r.category === selectedCategory);
}, [receipts, selectedCategory]);
```

**⚠️ WATCH OUT:**
- Don't over-memoize simple components (adds overhead)
- Ensure comparison functions in React.memo are correct
- Update dependency arrays when adding new dependencies
- Test that event handlers still work after useCallback

**Files to Update:**
- `src/components/shared/ReceiptThumbnail.tsx` - High impact
- `src/components/dashboard/CategoryChart.tsx` - High impact
- `src/components/dashboard/RecentReceipts.tsx` - High impact
- `src/components/receipts/*` - All receipt-related components

---

### 1.2 Virtual Scrolling for Large Lists

#### Issue: Rendering All List Items
**Current State:** ReceiptsPage renders all receipts at once (20-100+ items)

**Optimization:**
Install and implement `react-window` or `react-virtualized`:
```typescript
import { FixedSizeList } from 'react-window';

const ReceiptList = ({ receipts }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ReceiptThumbnail receipt={receipts[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={800}
      itemCount={receipts.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

**⚠️ WATCH OUT:**
- Selection state management needs adjustment
- Scroll position should be preserved on navigation
- Testing bulk actions with virtualized lists
- Ensure accessibility (screen readers) still works

**Files to Update:**
- `src/pages/ReceiptsPage.tsx` - Main receipts grid
- `src/components/admin/DeletedReceiptsManagement.tsx` - Deleted receipts list

---

### 1.3 Debounce Search & Filter Operations

#### Issue: Real-time Filtering on Every Keystroke
**Current State:** Filter operations trigger on every character typed

**Optimization:**
```typescript
import { useMemo, useState } from 'react';
import { debounce } from './utils/debounce';

const [searchQuery, setSearchQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

const debouncedSearch = useMemo(
  () => debounce((value: string) => {
    setDebouncedQuery(value);
  }, 300),
  []
);

const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setSearchQuery(e.target.value); // Immediate UI update
  debouncedSearch(e.target.value); // Delayed filter operation
};
```

**⚠️ WATCH OUT:**
- Clear debounce timers on unmount
- Don't debounce critical operations (save buttons)
- Test that users don't see stale results
- Ensure immediate visual feedback for typing

**Files to Update:**
- `src/hooks/useReceiptFilters.ts` - Search query handling
- `src/pages/SystemLogsPage.tsx` - Log filtering
- `src/pages/EnhancedAuditLogsPage.tsx` - Audit log filtering

---

### 1.4 Lazy Loading & Code Splitting

#### Issue: Loading All Components Upfront
**Current State:** All pages and heavy components loaded on initial bundle

**Optimization:**
```typescript
// App.tsx - Lazy load pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReceiptsPage = lazy(() => import('./pages/ReceiptsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// Lazy load heavy libraries
const PDFExport = lazy(() => import('./components/reports/PDFExportReport'));
const ChartComponent = lazy(() => import('./components/dashboard/CategoryChart'));

// Use Suspense boundary
<Suspense fallback={<LoadingSpinner />}>
  <ReportsPage />
</Suspense>
```

**⚠️ WATCH OUT:**
- Add proper error boundaries for failed lazy loads
- Ensure LoadingSpinner doesn't cause layout shift
- Test with slow 3G network simulation
- Preload critical routes on user hover/intent

**Files to Update:**
- `src/App.tsx` - Main router
- Components importing heavy libraries (jspdf, html2canvas, pdfjs)

---

### 1.5 Optimize useEffect Dependencies

#### Issue: Unnecessary Effect Triggers
**Current State:** Some effects run too frequently due to incorrect dependencies

**Optimization:**
```typescript
// BEFORE (runs on every render if not careful)
useEffect(() => {
  loadData();
}, [loadData]); // loadData might be recreated each render

// AFTER
const loadData = useCallback(async () => {
  // data loading logic
}, [dependency1, dependency2]);

useEffect(() => {
  loadData();
}, [loadData]);

// OR use refs for non-reactive values
const configRef = useRef(config);
useEffect(() => {
  loadData(configRef.current);
}, []); // Only runs once
```

**⚠️ WATCH OUT:**
- Don't remove necessary dependencies (causes stale closures)
- Use ESLint exhaustive-deps rule
- Test that data updates when it should
- Document intentional dependency omissions

**Files to Update:**
- `src/hooks/useReceiptsData.ts` - Multiple effects
- `src/pages/ReceiptsPage.tsx` - Collection loading
- `src/pages/TeamPage.tsx` - Team data loading

---

## 2. Database & Query Optimization

### 2.1 Add Database Indexes

#### Issue: Missing Indexes on Frequently Queried Columns
**Current State:** Queries scan full tables for filters

**Optimization:**
```sql
-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_receipts_collection_date
  ON receipts(collection_id, transaction_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_category
  ON receipts(collection_id, category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_parent
  ON receipts(parent_receipt_id)
  WHERE parent_receipt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp
  ON system_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
  ON audit_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON profiles(user_id);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_receipts_filters
  ON receipts(collection_id, category, transaction_date)
  WHERE deleted_at IS NULL AND extraction_status = 'completed';
```

**⚠️ WATCH OUT:**
- Indexes slow down INSERT/UPDATE operations
- Don't create indexes on low-cardinality columns
- Monitor index usage with pg_stat_user_indexes
- Consider partial indexes for better performance
- Test write-heavy operations aren't degraded

---

### 2.2 Optimize N+1 Query Problem

#### Issue: Multiple Sequential Queries
**Current State:** `useReceiptsData.ts` loads receipts then queries for each parent's first page

**Lines 148-164:**
```typescript
const receiptsWithThumbnails = await Promise.all((receiptsData || []).map(async (receipt) => {
  if (receipt.is_parent && receipt.total_pages > 1 && !receipt.thumbnail_path) {
    const { data: firstPage } = await supabase
      .from('receipts')
      .select('thumbnail_path, file_path')
      .eq('parent_receipt_id', receipt.id)
      .eq('page_number', 1)
      .single();
    // ...
  }
}));
```

**Optimization:**
```typescript
// Single query with LEFT JOIN
const { data: receiptsData } = await supabase
  .from('receipts')
  .select(`
    *,
    first_page:receipts!parent_receipt_id(
      thumbnail_path,
      file_path
    )
  `)
  .eq('collection_id', selectedCollection)
  .eq('extraction_status', 'completed')
  .is('deleted_at', null)
  .or('is_parent.eq.true,parent_receipt_id.is.null')
  .order('created_at', { ascending: false });

// Or use a database view/function
CREATE OR REPLACE FUNCTION get_receipts_with_thumbnails(collection_uuid UUID)
RETURNS TABLE (
  -- receipt columns
) AS $$
  SELECT r.*,
    COALESCE(r.thumbnail_path,
      (SELECT thumbnail_path FROM receipts
       WHERE parent_receipt_id = r.id
       AND page_number = 1 LIMIT 1)
    ) as thumbnail_path
  FROM receipts r
  WHERE r.collection_id = collection_uuid
    AND r.extraction_status = 'completed'
    AND r.deleted_at IS NULL;
$$ LANGUAGE sql STABLE;
```

**⚠️ WATCH OUT:**
- Test multi-page receipt thumbnail display
- Verify single-page receipts still work
- Check that page ordering is correct
- Ensure RLS policies still apply

**Files to Update:**
- `src/hooks/useReceiptsData.ts` - loadReceipts function

---

### 2.3 Implement Query Result Pagination & Cursor-Based Pagination

#### Issue: Loading Large Result Sets
**Current State:** Using offset-based pagination (LIMIT/OFFSET) which becomes slow for large offsets

**Optimization:**
```typescript
// Cursor-based pagination for better performance
const loadReceiptsWithCursor = async (cursor?: string, limit: number = 20) => {
  let query = supabase
    .from('receipts')
    .select('*')
    .eq('collection_id', selectedCollection)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  return {
    receipts: data,
    nextCursor: data && data.length > 0 ? data[data.length - 1].created_at : null
  };
};
```

**⚠️ WATCH OUT:**
- Page numbers won't work (infinite scroll only)
- Sorting changes require cursor recalculation
- Test "jump to page" functionality if needed
- Handle deleted items in cursor calculations

---

### 2.4 Optimize RLS Policies

#### Issue: Complex RLS Policies on Every Query
**Current State:** Multiple RLS policy checks per query

**Optimization:**
```sql
-- Create optimized RLS policies with better indexing
-- Before: Multiple policy checks
-- After: Single combined policy with indexed columns

-- Example: Optimize receipts RLS
DROP POLICY IF EXISTS "Users can view receipts in their collections" ON receipts;
DROP POLICY IF EXISTS "Team members can view team receipts" ON receipts;

CREATE POLICY "optimized_view_receipts" ON receipts
  FOR SELECT
  TO authenticated
  USING (
    collection_id IN (
      SELECT c.id
      FROM collections c
      INNER JOIN businesses b ON c.business_id = b.id
      INNER JOIN team_members tm ON b.id = tm.business_id
      WHERE tm.user_id = auth.uid()
        AND (tm.user_id IS NOT NULL OR b.owner_id = auth.uid())
    )
  );

-- Add function-based RLS for better performance
CREATE OR REPLACE FUNCTION user_can_access_collection(collection_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    INNER JOIN businesses b ON c.business_id = b.id
    LEFT JOIN team_members tm ON b.id = tm.business_id
    WHERE c.id = collection_uuid
      AND (b.owner_id = auth.uid() OR tm.user_id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Use in policy
CREATE POLICY "function_based_view" ON receipts
  FOR SELECT TO authenticated
  USING (user_can_access_collection(collection_id));
```

**⚠️ WATCH OUT:**
- Test all permission scenarios thoroughly
- Ensure security isn't compromised
- Verify team member access still works
- Check that deleted users lose access immediately

---

### 2.5 Database Connection Pooling

#### Issue: Connection Management
**Current State:** Default Supabase connection pooling

**Optimization:**
```typescript
// Configure connection pooling in supabase client
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        'x-connection-pool': 'enabled',
      },
    },
  }
);
```

**⚠️ WATCH OUT:**
- Monitor connection pool exhaustion
- Test concurrent user scenarios
- Check for connection leaks in error cases

---

## 3. API & Network Optimization

### 3.1 Implement Request Batching

#### Issue: Multiple Simultaneous API Calls
**Current State:** Separate calls for collections, businesses, categories

**Optimization:**
```typescript
// Batch related queries
const loadInitialData = async () => {
  const [collections, businesses, categories, userProfile] = await Promise.all([
    supabase.from('collections').select('*, businesses(name)'),
    supabase.from('businesses').select('id, name'),
    supabase.from('expense_categories').select('*'),
    supabase.from('profiles').select('*').eq('user_id', user.id).single()
  ]);

  return { collections, businesses, categories, userProfile };
};
```

**⚠️ WATCH OUT:**
- One failed request shouldn't block others
- Handle partial failures gracefully
- Consider if truly parallel or can be sequential
- Test error states for each request

**Files to Update:**
- `src/hooks/useReceiptsData.ts` - Already doing this, verify others
- `src/pages/DashboardPage.tsx` - Dashboard data loading
- `src/pages/AdminPage.tsx` - Admin dashboard

---

### 3.2 Implement Request Caching with React Query

#### Issue: Refetching Same Data
**Current State:** React Query installed but underutilized

**Optimization:**
```typescript
// src/hooks/useReceiptsData.ts - Convert to React Query
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useReceiptsData(selectedCollection: string) {
  const queryClient = useQueryClient();

  const { data: collections, isLoading: collectionsLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('*, businesses(name)');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
  });

  const { data: receipts, isLoading: receiptsLoading } = useQuery({
    queryKey: ['receipts', selectedCollection],
    queryFn: async () => {
      const { data } = await supabase
        .from('receipts')
        .select('*')
        .eq('collection_id', selectedCollection);
      return data;
    },
    enabled: !!selectedCollection,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Optimistic updates
  const deleteReceipt = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('receipts').delete().eq('id', id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['receipts', selectedCollection] });
      const previous = queryClient.getQueryData(['receipts', selectedCollection]);

      queryClient.setQueryData(['receipts', selectedCollection], (old: any) =>
        old.filter((r: any) => r.id !== id)
      );

      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['receipts', selectedCollection], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts', selectedCollection] });
    },
  });

  return { collections, receipts, deleteReceipt };
}
```

**⚠️ WATCH OUT:**
- Configure proper staleTime to avoid stale data
- Test cache invalidation on updates
- Ensure real-time updates still work
- Handle race conditions in optimistic updates
- Test offline/online transitions

**Files to Update:**
- `src/hooks/useReceiptsData.ts` - Primary conversion
- `src/hooks/useCategories.ts` - Categories caching
- `src/hooks/useCollections.ts` - Collections caching
- `src/hooks/useDashboard.ts` - Dashboard data

---

### 3.3 Implement Response Compression

#### Issue: Large JSON Responses
**Current State:** No explicit compression configuration

**Optimization:**
```typescript
// Edge Function: Compress large responses
// supabase/functions/extract-receipt-data/index.ts
import { gzip } from 'https://deno.land/x/compress@v0.4.5/mod.ts';

Deno.serve(async (req) => {
  const response = await processReceipt(req);
  const responseBody = JSON.stringify(response);

  // Compress if response is large
  if (responseBody.length > 1024) {
    const compressed = gzip(new TextEncoder().encode(responseBody));
    return new Response(compressed, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      },
    });
  }

  return new Response(responseBody, {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**⚠️ WATCH OUT:**
- Browser automatically decompresses gzipped responses
- Don't compress already-compressed data (images)
- Test with different browsers
- Verify Content-Encoding headers are correct

---

### 3.4 Optimize Edge Function Performance

#### Issue: Cold Starts & Execution Time
**Current State:** Edge functions may have cold start delays

**Optimization:**
```typescript
// Keep connections warm
let cachedSupabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        global: {
          headers: {
            'Connection': 'keep-alive',
          },
        },
      }
    );
  }
  return cachedSupabaseClient;
}

// Minimize dependencies
// Use streaming for large responses
Deno.serve(async (req) => {
  const stream = new ReadableStream({
    async start(controller) {
      const data = await processInChunks();
      for (const chunk of data) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk)));
      }
      controller.close();
    },
  });

  return new Response(stream);
});
```

**⚠️ WATCH OUT:**
- Test edge function timeouts
- Ensure cleanup on connection close
- Handle client disconnections gracefully
- Monitor memory usage

**Files to Update:**
- `supabase/functions/extract-receipt-data/index.ts`
- `supabase/functions/process-export-job/index.ts`

---

## 4. Bundle Size & Code Splitting

### 4.1 Analyze & Reduce Bundle Size

#### Current Bundle Analysis:
```
dist/index-BoOCj8dX.js: 1,709.65 KB (457.61 KB gzipped)
  - pdfjs-dist: ~1,046 KB (PDF worker)
  - jspdf: ~413 KB
  - html2canvas: ~201 KB
  - Other libraries: ~150 KB
```

**Optimization:**
```javascript
// vite.config.ts - Add bundle analysis
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'pdf-vendor': ['pdfjs-dist'],
          'export-vendor': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'charts': ['recharts'], // If using charts
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
```

**⚠️ WATCH OUT:**
- Don't over-split (many small chunks = many requests)
- Test with HTTP/2 multiplexing
- Verify chunk names are stable for caching
- Test production builds thoroughly

---

### 4.2 Dynamic Imports for Heavy Features

#### Issue: Loading PDF/Export Libraries Upfront

**Optimization:**
```typescript
// src/components/reports/PDFExportReport.tsx
const handleExportPDF = async () => {
  setLoading(true);

  // Dynamic import - only loaded when user clicks export
  const { exportToPDF } = await import('../utils/pdfExporter');
  await exportToPDF(data);

  setLoading(false);
};

// Create wrapper module for dynamic imports
// src/utils/pdfExporter.ts
export async function exportToPDF(data: any) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF();
  // ... export logic
  return doc;
}
```

**⚠️ WATCH OUT:**
- Show loading state during import
- Handle import failures
- Test that exports still work
- Consider preloading on user intent (hover)

**Files to Update:**
- `src/components/reports/PDFExportReport.tsx`
- `src/components/reports/CSVExportReport.tsx`
- `src/lib/pdfConverter.ts`

---

### 4.3 Tree Shaking Optimization

#### Issue: Importing Entire Libraries

**Optimization:**
```typescript
// BEFORE
import * as Lucide from 'lucide-react';
<Lucide.Search />

// AFTER - Tree-shakable imports
import { Search, Plus, Trash } from 'lucide-react';
<Search />

// For lodash
// BEFORE
import _ from 'lodash';
_.debounce(fn, 300);

// AFTER
import debounce from 'lodash/debounce';
debounce(fn, 300);
```

**⚠️ WATCH OUT:**
- Verify Vite tree-shaking is working
- Check that icons still render
- Test production bundle size
- Don't break barrel exports if relying on them

---

### 4.4 Remove Unused Dependencies

**Optimization:**
```bash
# Analyze unused dependencies
npx depcheck

# Consider alternatives
# @tanstack/react-query - KEEP (should be used more)
# isomorphic-dompurify - KEEP (security)
# @sentry/react - KEEP (monitoring)

# Heavy libraries to audit:
# - Can qrcode be lazy loaded? (Only used in MFA setup)
# - Is jszip necessary or can use browser native?
```

**⚠️ WATCH OUT:**
- Don't remove dev dependencies
- Test thoroughly after removal
- Check for dynamic requires
- Verify no runtime errors

---

## 5. Image & Media Optimization

### 5.1 Implement Progressive Image Loading

#### Issue: Loading Full Images Immediately

**Optimization:**
```typescript
// src/components/shared/ReceiptThumbnail.tsx
export function ReceiptThumbnail({ receipt }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>();

  useEffect(() => {
    // Load thumbnail first (already optimized to 200x200)
    const img = new Image();
    img.src = getThumbnailUrl(receipt.thumbnail_path);
    img.onload = () => {
      setImageSrc(img.src);
      setImageLoaded(true);
    };
  }, [receipt.thumbnail_path]);

  return (
    <div className="relative">
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <img
        src={imageSrc}
        alt="Receipt"
        className={`transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
```

**⚠️ WATCH OUT:**
- Test with slow network
- Ensure layout doesn't shift
- Handle image load failures
- Test accessibility with screen readers

**Files to Update:**
- `src/components/shared/ReceiptThumbnail.tsx`
- `src/components/receipts/PageThumbnailStrip.tsx`

---

### 5.2 Implement Image CDN & Transformations

#### Issue: Serving Original Images

**Optimization:**
```typescript
// Use Supabase image transformations
function getOptimizedImageUrl(path: string, width: number, quality: number = 80) {
  const { data } = supabase.storage
    .from('receipts')
    .getPublicUrl(path, {
      transform: {
        width,
        height: width,
        resize: 'contain',
        quality,
        format: 'webp',
      },
    });

  return data.publicUrl;
}

// Usage
<img
  src={getOptimizedImageUrl(receipt.thumbnail_path, 200)}
  srcSet={`
    ${getOptimizedImageUrl(receipt.thumbnail_path, 200)} 1x,
    ${getOptimizedImageUrl(receipt.thumbnail_path, 400)} 2x
  `}
  loading="lazy"
/>
```

**⚠️ WATCH OUT:**
- Verify Supabase plan supports transformations
- Test transformation limits
- Fallback to original if transformation fails
- Cache transformed URLs

---

### 5.3 Optimize Image Upload Pipeline

#### Current Optimization Review:
`src/lib/imageOptimizer.ts` is already well-optimized:
- ✅ WebP conversion
- ✅ 2048px max dimension
- ✅ 200x200 thumbnails
- ✅ Quality: 0.92 for full, 0.85 for thumbnails

**Additional Optimization:**
```typescript
// Add image dimension validation before upload
export async function validateAndOptimize(file: File): Promise<OptimizedImages | null> {
  const dimensions = await getImageDimensions(file);

  // Skip optimization if already optimal
  if (
    dimensions.width <= 2048 &&
    dimensions.height <= 2048 &&
    file.type === 'image/webp' &&
    file.size < 500000 // < 500KB
  ) {
    // Already optimized, just create thumbnail
    const thumbnail = await createThumbnail(file);
    return { full: file, thumbnail };
  }

  return optimizeImage(file);
}

// Parallelize multi-page optimizations
export async function optimizeBatch(files: File[]): Promise<OptimizedImages[]> {
  const BATCH_SIZE = 3; // Process 3 at a time
  const results: OptimizedImages[] = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(file => optimizeImage(file))
    );
    results.push(...batchResults);
  }

  return results;
}
```

**⚠️ WATCH OUT:**
- Don't break existing uploads
- Test with various image formats
- Verify WebP browser support fallback
- Test memory usage with large batches

**Files to Update:**
- `src/lib/imageOptimizer.ts`
- `src/pages/ReceiptsPage.tsx` - Multi-page uploads

---

## 6. Caching Strategy

### 6.1 Implement Service Worker for Offline Support

**Optimization:**
```typescript
// src/serviceWorker.ts
const CACHE_NAME = 'audit-proof-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Network first for API calls
  if (event.request.url.includes('/api/') || event.request.url.includes('/functions/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache first for static assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

**⚠️ WATCH OUT:**
- Don't cache authenticated API responses
- Implement cache versioning strategy
- Test cache invalidation
- Handle offline authentication properly

---

### 6.2 Implement Browser Storage for Drafts

**Optimization:**
```typescript
// src/utils/draftStorage.ts
export function saveDraft(key: string, data: any) {
  try {
    localStorage.setItem(`draft_${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    // Handle quota exceeded
    clearOldDrafts();
  }
}

export function loadDraft(key: string, maxAge: number = 3600000): any | null {
  const item = localStorage.getItem(`draft_${key}`);
  if (!item) return null;

  const { data, timestamp } = JSON.parse(item);
  if (Date.now() - timestamp > maxAge) {
    localStorage.removeItem(`draft_${key}`);
    return null;
  }

  return data;
}

// Use in forms
export function ManualEntryForm() {
  const [formData, setFormData] = useState(() => {
    return loadDraft('manual-entry') || initialState;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      saveDraft('manual-entry', formData);
    }, 5000); // Auto-save every 5 seconds

    return () => clearInterval(timer);
  }, [formData]);
}
```

**⚠️ WATCH OUT:**
- Clear drafts after successful submit
- Handle storage quota
- Don't store sensitive data in localStorage
- Test with browser privacy modes

**Files to Update:**
- `src/components/receipts/ManualEntryForm.tsx`
- `src/components/receipts/EditReceiptModal.tsx`

---

### 6.3 HTTP Caching Headers

**Optimization:**
```typescript
// Configure in Vite/hosting
// _headers file for Netlify/Vercel
/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache, must-revalidate

/api/*
  Cache-Control: no-store
```

**⚠️ WATCH OUT:**
- Don't cache HTML files
- Use cache busting for updated assets
- Test that users get updates
- Handle CDN cache invalidation

---

## 7. Browser Performance

### 7.1 Optimize CSS & Animations

**Optimization:**
```css
/* Use CSS containment */
.receipt-card {
  contain: layout style paint;
}

/* Use transform for animations (GPU accelerated) */
.modal-enter {
  transform: scale(0.95) translateZ(0);
  transition: transform 0.2s ease-out;
  will-change: transform;
}

/* Avoid layout thrashing */
.list-item {
  /* Use transform instead of top/left */
  transform: translateY(0);
}
```

**⚠️ WATCH OUT:**
- Don't overuse will-change (memory)
- Test on mobile devices
- Ensure animations are smooth 60fps
- Check accessibility (prefers-reduced-motion)

---

### 7.2 Optimize Event Listeners

**Optimization:**
```typescript
// Use event delegation
function ReceiptsList({ receipts }) {
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const receiptCard = target.closest('[data-receipt-id]');
    if (!receiptCard) return;

    const receiptId = receiptCard.getAttribute('data-receipt-id');
    onReceiptClick(receiptId);
  };

  return (
    <div onClick={handleClick}>
      {receipts.map(receipt => (
        <div key={receipt.id} data-receipt-id={receipt.id}>
          {/* content */}
        </div>
      ))}
    </div>
  );
}

// Use passive event listeners for scroll
useEffect(() => {
  const handleScroll = () => {
    // scroll logic
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

**⚠️ WATCH OUT:**
- Test that event bubbling works correctly
- Ensure accessibility (keyboard navigation)
- Don't break existing event handlers

---

### 7.3 Implement Intersection Observer

**Optimization:**
```typescript
// Lazy load components when visible
export function LazySection({ children }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {isVisible ? children : <Skeleton />}
    </div>
  );
}
```

**⚠️ WATCH OUT:**
- Provide fallback for older browsers
- Test that content loads when needed
- Don't lazy load critical content
- Handle rapid scrolling

**Files to Update:**
- `src/components/dashboard/CategoryChart.tsx` - Chart rendering
- `src/components/dashboard/RecentReceipts.tsx` - Recent items
- `src/pages/ReceiptsPage.tsx` - Receipt grid

---

### 7.4 Web Workers for Heavy Computation

**Optimization:**
```typescript
// src/workers/imageProcessor.worker.ts
self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'optimize') {
    const result = await optimizeImageInWorker(data);
    self.postMessage({ type: 'optimized', result });
  }
};

// Usage in component
const worker = useMemo(() => new Worker(
  new URL('./workers/imageProcessor.worker.ts', import.meta.url),
  { type: 'module' }
), []);

const optimizeImages = async (files: File[]) => {
  return new Promise((resolve) => {
    worker.postMessage({ type: 'optimize', data: files });
    worker.onmessage = (e) => {
      if (e.data.type === 'optimized') {
        resolve(e.data.result);
      }
    };
  });
};
```

**⚠️ WATCH OUT:**
- Workers can't access DOM
- Test that file transfers work (transferable objects)
- Handle worker termination
- Test on mobile devices (memory constraints)

**Files to Update:**
- `src/lib/imageOptimizer.ts` - Image processing
- `src/lib/pdfConverter.ts` - PDF processing

---

## 8. Implementation Priority Matrix

### Phase 1: Quick Wins (1-2 days)
**High Impact, Low Effort**

1. ✅ Add database indexes (2 hours)
2. ✅ Implement debounced search (2 hours)
3. ✅ Add React.memo to ReceiptThumbnail (1 hour)
4. ✅ Optimize N+1 query in useReceiptsData (3 hours)
5. ✅ Add loading="lazy" to all images (1 hour)
6. ✅ Implement request batching for initial data (2 hours)

**Total Estimated Time:** 11 hours
**Expected Performance Gain:** 20-30% improvement in load times

---

### Phase 2: Core Optimizations (3-5 days)
**High Impact, Medium Effort**

1. ✅ Convert to React Query for data fetching (8 hours)
2. ✅ Implement virtual scrolling for receipts list (6 hours)
3. ✅ Add lazy loading for pages (4 hours)
4. ✅ Optimize RLS policies (6 hours)
5. ✅ Implement progressive image loading (4 hours)
6. ✅ Add bundle splitting (4 hours)

**Total Estimated Time:** 32 hours
**Expected Performance Gain:** 40-50% improvement

---

### Phase 3: Advanced Optimizations (1-2 weeks)
**Medium Impact, High Effort**

1. ✅ Implement service worker (16 hours)
2. ✅ Add web workers for image processing (12 hours)
3. ✅ Implement cursor-based pagination (8 hours)
4. ✅ Optimize edge functions (8 hours)
5. ✅ Add intersection observers (6 hours)
6. ✅ Implement draft auto-save (6 hours)

**Total Estimated Time:** 56 hours
**Expected Performance Gain:** Additional 15-20% improvement

---

### Phase 4: Fine-Tuning (Ongoing)
**Continuous Monitoring**

1. ✅ Monitor bundle size with each release
2. ✅ Track Core Web Vitals
3. ✅ A/B test caching strategies
4. ✅ Optimize based on real user metrics
5. ✅ Regular performance audits

---

## Performance Monitoring

### Metrics to Track

1. **Core Web Vitals**
   - LCP (Largest Contentful Paint): < 2.5s
   - FID (First Input Delay): < 100ms
   - CLS (Cumulative Layout Shift): < 0.1

2. **Custom Metrics**
   - Time to Interactive (TTI)
   - Receipt grid render time
   - Image upload processing time
   - Search/filter response time
   - Database query times

3. **Tools**
   - Lighthouse CI for each PR
   - Sentry performance monitoring
   - Custom performance marks in code
   - Supabase query analyzer

```typescript
// Add performance marks
performance.mark('receipts-load-start');
await loadReceipts();
performance.mark('receipts-load-end');
performance.measure('receipts-load', 'receipts-load-start', 'receipts-load-end');

const measure = performance.getEntriesByName('receipts-load')[0];
logger.info('Performance metric', {
  category: 'PERFORMANCE',
  metric: 'receipts-load',
  duration: measure.duration,
});
```

---

## Testing Strategy

### Before Implementation
1. ✅ Establish baseline metrics (Lighthouse scores, load times)
2. ✅ Create performance budget
3. ✅ Document current user flows and timings

### During Implementation
1. ✅ Test each optimization in isolation
2. ✅ Verify no functionality breaks
3. ✅ Measure performance impact
4. ✅ Rollback if issues detected

### After Implementation
1. ✅ Run full test suite
2. ✅ Performance testing on various devices
3. ✅ Monitor error rates
4. ✅ Collect user feedback
5. ✅ Document lessons learned

---

## Critical Watch-Outs Summary

### Security
- ✅ Verify RLS policies still enforce access control
- ✅ Don't cache sensitive data in browser storage
- ✅ Ensure service worker doesn't expose private data
- ✅ Test authentication after caching changes

### Functionality
- ✅ Multi-page receipt handling
- ✅ Bulk operations (select, delete, categorize)
- ✅ Real-time updates and notifications
- ✅ File upload and processing
- ✅ Export functionality (PDF, CSV)

### User Experience
- ✅ No layout shifts during loading
- ✅ Maintain scroll position
- ✅ Preserve form data on navigation
- ✅ Loading states for all async operations
- ✅ Error handling and recovery

### Data Integrity
- ✅ Optimistic updates can be rolled back
- ✅ Cache invalidation on data changes
- ✅ No data loss during optimization
- ✅ Audit logs still capture all events

---

## Rollback Plan

For each optimization:

1. **Tag the commit** before implementing changes
2. **Feature flags** for major changes
3. **Gradual rollout** (10% → 50% → 100%)
4. **Monitoring alerts** for degraded performance
5. **Quick rollback script** ready
6. **Communication plan** for users if issues occur

```bash
# Quick rollback command
git revert <commit-hash>
npm run build
# Deploy previous version
```

---

## Conclusion

This comprehensive plan addresses performance optimization across all layers of the application. By following the phased approach and carefully watching for the identified issues, we can achieve significant performance improvements without introducing breaking changes or bugs.

**Expected Overall Improvement:**
- 50-70% reduction in initial load time
- 60-80% reduction in time to interactive
- 40-50% reduction in bundle size
- 70-90% reduction in database query times
- Improved Core Web Vitals scores across the board

**Next Steps:**
1. Review and approve this plan
2. Set up performance monitoring baseline
3. Begin Phase 1 implementation
4. Document results and adjust plan as needed
