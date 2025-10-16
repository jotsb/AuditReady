# Performance Optimization Implementation Plan

**Status:** Ready to Begin
**Document Reference:** `/analysis/PERFORMANCE_OPTIMIZATION_PLAN.md`
**Expected Total Time:** ~99 hours (12-15 working days)
**Expected Performance Gain:** 50-70% overall improvement

---

## Phase 1: Quick Wins (Day 1-2)
**Priority:** CRITICAL | **Effort:** LOW | **Impact:** HIGH
**Time:** 11 hours | **Expected Gain:** 20-30%

### 1.1 Database Indexes ⏱️ 2 hours
- [ ] Add index on `receipts(collection_id, transaction_date DESC)` with WHERE deleted_at IS NULL
- [ ] Add index on `receipts(collection_id, category)` with WHERE deleted_at IS NULL
- [ ] Add index on `receipts(parent_receipt_id)` where parent_receipt_id IS NOT NULL
- [ ] Add index on `system_logs(timestamp DESC)`
- [ ] Add index on `audit_logs(timestamp DESC)`
- [ ] Add index on `profiles(user_id)`
- [ ] Add composite index `receipts(collection_id, category, transaction_date)`
- [ ] Test query performance before/after
- [ ] Monitor for write performance degradation

**Files:**
- Create new migration: `supabase/migrations/[timestamp]_add_performance_indexes.sql`

**Watch Outs:**
- Indexes slow down INSERT/UPDATE operations
- Don't create indexes on low-cardinality columns
- Monitor index usage with pg_stat_user_indexes

---

### 1.2 Implement Debounced Search ⏱️ 2 hours
- [ ] Create debounce utility function in `src/utils/debounce.ts`
- [ ] Update `src/hooks/useReceiptFilters.ts` with debounced search
- [ ] Update `src/pages/SystemLogsPage.tsx` with debounced filtering
- [ ] Update `src/pages/EnhancedAuditLogsPage.tsx` with debounced filtering
- [ ] Update `src/components/audit/AdvancedLogFilterPanel.tsx`
- [ ] Test that typing feels responsive
- [ ] Verify no stale results displayed
- [ ] Ensure cleanup on component unmount

**Files:**
- New: `src/utils/debounce.ts`
- Modify: `src/hooks/useReceiptFilters.ts`
- Modify: `src/pages/SystemLogsPage.tsx`
- Modify: `src/pages/EnhancedAuditLogsPage.tsx`
- Modify: `src/components/audit/AdvancedLogFilterPanel.tsx`

**Watch Outs:**
- Clear debounce timers on unmount
- Don't debounce critical operations (save buttons)
- Ensure immediate visual feedback for typing

---

### 1.3 Add React.memo to ReceiptThumbnail ⏱️ 1 hour
- [ ] Wrap ReceiptThumbnail component with React.memo
- [ ] Add custom comparison function for props
- [ ] Test that thumbnails still render correctly
- [ ] Test that click handlers still work
- [ ] Verify re-renders are reduced (React DevTools)

**Files:**
- Modify: `src/components/shared/ReceiptThumbnail.tsx`

**Watch Outs:**
- Ensure comparison function checks all relevant props
- Test bulk selection functionality
- Don't break click handlers

---

### 1.4 Optimize N+1 Query in useReceiptsData ⏱️ 3 hours
- [ ] Create database function `get_receipts_with_thumbnails()`
- [ ] Update RLS policies for the new function
- [ ] Modify `src/hooks/useReceiptsData.ts` to use single query
- [ ] Remove Promise.all loop for thumbnail fetching
- [ ] Test multi-page receipts display correctly
- [ ] Test single-page receipts still work
- [ ] Verify performance improvement (network tab)

**Files:**
- Create migration: `supabase/migrations/[timestamp]_add_receipts_thumbnail_function.sql`
- Modify: `src/hooks/useReceiptsData.ts`

**Watch Outs:**
- Verify RLS policies still apply to function
- Test multi-page receipt thumbnail display
- Check that page ordering is correct

---

### 1.5 Add loading="lazy" to All Images ⏱️ 1 hour
- [ ] Audit all `<img>` tags in codebase
- [ ] Add `loading="lazy"` and `decoding="async"` attributes
- [ ] Test images still load when scrolled into view
- [ ] Verify no broken images
- [ ] Check layout doesn't shift

**Files:**
- Modify: `src/components/shared/ReceiptThumbnail.tsx`
- Modify: `src/components/receipts/PageThumbnailStrip.tsx`
- Modify: `src/components/dashboard/RecentReceipts.tsx`
- Check all other image usages

**Watch Outs:**
- Don't lazy load above-the-fold images
- Test on slow network connections
- Ensure placeholder/skeleton exists

---

### 1.6 Implement Request Batching ⏱️ 2 hours
- [ ] Create `loadInitialData()` function in relevant hooks
- [ ] Batch collections, businesses, categories queries
- [ ] Update `src/hooks/useReceiptsData.ts`
- [ ] Update `src/pages/DashboardPage.tsx`
- [ ] Handle partial failures gracefully
- [ ] Test error scenarios for each request

**Files:**
- Modify: `src/hooks/useReceiptsData.ts`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/AdminPage.tsx`

**Watch Outs:**
- One failed request shouldn't block others
- Handle partial failures gracefully
- Test error states for each request

---

## Phase 2: Core Optimizations (Day 3-7)
**Priority:** HIGH | **Effort:** MEDIUM | **Impact:** HIGH
**Time:** 32 hours | **Expected Gain:** 40-50%

### 2.1 Convert to React Query ⏱️ 8 hours
- [ ] Set up React Query DevTools for development
- [ ] Convert `src/hooks/useReceiptsData.ts` to use useQuery
- [ ] Convert `src/hooks/useCategories.ts` to use useQuery
- [ ] Convert `src/hooks/useCollections.ts` to use useQuery
- [ ] Convert `src/hooks/useDashboard.ts` to use useQuery
- [ ] Implement optimistic updates for mutations
- [ ] Configure proper staleTime and cacheTime
- [ ] Test cache invalidation on updates
- [ ] Verify real-time updates still work

**Files:**
- Modify: `src/lib/queryClient.ts` (add configuration)
- Modify: `src/hooks/useReceiptsData.ts`
- Modify: `src/hooks/useCategories.ts`
- Modify: `src/hooks/useCollections.ts`
- Modify: `src/hooks/useDashboard.ts`

**Watch Outs:**
- Configure proper staleTime to avoid stale data
- Test cache invalidation on updates
- Ensure real-time updates still work
- Handle race conditions in optimistic updates

---

### 2.2 Implement Virtual Scrolling ⏱️ 6 hours
- [ ] Install `react-window` package
- [ ] Create VirtualReceiptList component
- [ ] Update ReceiptsPage to use virtual scrolling
- [ ] Handle selection state with virtualization
- [ ] Preserve scroll position on navigation
- [ ] Test bulk actions with virtualized list
- [ ] Test accessibility (keyboard navigation)

**Files:**
- New: `src/components/receipts/VirtualReceiptList.tsx`
- Modify: `src/pages/ReceiptsPage.tsx`
- Modify: `package.json` (add react-window)

**Watch Outs:**
- Selection state management needs adjustment
- Scroll position preservation
- Test bulk actions functionality
- Ensure accessibility (screen readers) works

---

### 2.3 Add Lazy Loading for Pages ⏱️ 4 hours
- [ ] Convert page imports to lazy() in App.tsx
- [ ] Add Suspense boundaries with LoadingSpinner
- [ ] Lazy load heavy components (PDFExport, Charts)
- [ ] Add error boundaries for failed lazy loads
- [ ] Test with slow 3G network simulation
- [ ] Implement route preloading on hover

**Files:**
- Modify: `src/App.tsx`
- Verify: `src/components/shared/LoadingSpinner.tsx`
- Add error boundaries if needed

**Watch Outs:**
- Add proper error boundaries for failed lazy loads
- Ensure LoadingSpinner doesn't cause layout shift
- Test with slow 3G network simulation
- Preload critical routes on user hover/intent

---

### 2.4 Optimize RLS Policies ⏱️ 6 hours
- [ ] Audit all RLS policies for complexity
- [ ] Create function-based RLS helpers
- [ ] Consolidate multiple policies into single optimized ones
- [ ] Add indexes to support RLS policy queries
- [ ] Test all permission scenarios
- [ ] Verify security isn't compromised

**Files:**
- Create migration: `supabase/migrations/[timestamp]_optimize_rls_policies.sql`

**Watch Outs:**
- Test all permission scenarios thoroughly
- Ensure security isn't compromised
- Verify team member access still works
- Check that deleted users lose access immediately

---

### 2.5 Implement Progressive Image Loading ⏱️ 4 hours
- [ ] Add image load state to ReceiptThumbnail
- [ ] Implement skeleton/blur-up effect
- [ ] Add error handling for failed loads
- [ ] Test with slow network conditions
- [ ] Verify no layout shift occurs

**Files:**
- Modify: `src/components/shared/ReceiptThumbnail.tsx`
- Modify: `src/components/receipts/PageThumbnailStrip.tsx`

**Watch Outs:**
- Test with slow network
- Ensure layout doesn't shift
- Handle image load failures
- Test accessibility with screen readers

---

### 2.6 Add Bundle Splitting ⏱️ 4 hours
- [ ] Install rollup-plugin-visualizer
- [ ] Configure manualChunks in vite.config.ts
- [ ] Create separate chunks for vendors
- [ ] Analyze bundle with visualizer
- [ ] Test that chunks load correctly
- [ ] Verify cache headers are set

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (add visualizer)

**Watch Outs:**
- Don't over-split (many small chunks = many requests)
- Test with HTTP/2 multiplexing
- Verify chunk names are stable for caching
- Test production builds thoroughly

---

## Phase 3: Advanced Optimizations (Day 8-15)
**Priority:** MEDIUM | **Effort:** HIGH | **Impact:** MEDIUM
**Time:** 56 hours | **Expected Gain:** +15-20%

### 3.1 Implement Service Worker ⏱️ 16 hours
- [ ] Create service worker file
- [ ] Implement cache-first strategy for static assets
- [ ] Implement network-first strategy for API calls
- [ ] Add offline page
- [ ] Test offline functionality
- [ ] Implement cache versioning
- [ ] Test cache invalidation

**Files:**
- New: `src/serviceWorker.ts`
- New: `public/offline.html`
- Modify: `src/main.tsx` (register SW)

**Watch Outs:**
- Don't cache authenticated API responses
- Implement cache versioning strategy
- Test cache invalidation
- Handle offline authentication properly

---

### 3.2 Add Web Workers for Image Processing ⏱️ 12 hours
- [ ] Create image processor worker
- [ ] Move optimization logic to worker
- [ ] Implement worker communication protocol
- [ ] Test with multiple files
- [ ] Handle worker errors gracefully
- [ ] Test on mobile devices

**Files:**
- New: `src/workers/imageProcessor.worker.ts`
- Modify: `src/lib/imageOptimizer.ts`
- Modify: `src/pages/ReceiptsPage.tsx`

**Watch Outs:**
- Workers can't access DOM
- Test file transfers work (transferable objects)
- Handle worker termination
- Test on mobile devices (memory constraints)

---

### 3.3 Implement Cursor-Based Pagination ⏱️ 8 hours
- [ ] Create cursor-based pagination function
- [ ] Update ReceiptsPage to use cursor pagination
- [ ] Implement infinite scroll UI
- [ ] Handle edge cases (deleted items)
- [ ] Test rapid scrolling
- [ ] Test sorting changes

**Files:**
- Modify: `src/hooks/useReceiptsData.ts`
- Modify: `src/pages/ReceiptsPage.tsx`

**Watch Outs:**
- Page numbers won't work (infinite scroll only)
- Sorting changes require cursor recalculation
- Handle deleted items in cursor calculations
- Test "jump to page" functionality if needed

---

### 3.4 Optimize Edge Functions ⏱️ 8 hours
- [ ] Implement connection caching in edge functions
- [ ] Add response streaming for large payloads
- [ ] Optimize dependency imports
- [ ] Add function warming strategy
- [ ] Test cold start times
- [ ] Monitor memory usage

**Files:**
- Modify: `supabase/functions/extract-receipt-data/index.ts`
- Modify: `supabase/functions/process-export-job/index.ts`

**Watch Outs:**
- Test edge function timeouts
- Ensure cleanup on connection close
- Handle client disconnections gracefully
- Monitor memory usage

---

### 3.5 Add Intersection Observers ⏱️ 6 hours
- [ ] Create LazySection component
- [ ] Implement Intersection Observer hook
- [ ] Apply to dashboard charts
- [ ] Apply to recent receipts
- [ ] Apply to receipt grid
- [ ] Test visibility detection
- [ ] Add fallback for older browsers

**Files:**
- New: `src/hooks/useIntersectionObserver.ts`
- New: `src/components/shared/LazySection.tsx`
- Modify: `src/components/dashboard/CategoryChart.tsx`
- Modify: `src/components/dashboard/RecentReceipts.tsx`

**Watch Outs:**
- Provide fallback for older browsers
- Test that content loads when needed
- Don't lazy load critical content
- Handle rapid scrolling

---

### 3.6 Implement Draft Auto-Save ⏱️ 6 hours
- [ ] Create draft storage utility
- [ ] Add auto-save to ManualEntryForm
- [ ] Add auto-save to EditReceiptModal
- [ ] Add draft recovery on load
- [ ] Handle storage quota exceeded
- [ ] Test with browser privacy modes

**Files:**
- New: `src/utils/draftStorage.ts`
- Modify: `src/components/receipts/ManualEntryForm.tsx`
- Modify: `src/components/receipts/EditReceiptModal.tsx`

**Watch Outs:**
- Clear drafts after successful submit
- Handle storage quota
- Don't store sensitive data in localStorage
- Test with browser privacy modes

---

## Phase 4: Fine-Tuning & Polish (Ongoing)
**Priority:** LOW | **Effort:** ONGOING | **Impact:** CUMULATIVE

### 4.1 Performance Monitoring Setup
- [ ] Set up Lighthouse CI in GitHub Actions
- [ ] Configure performance budgets
- [ ] Set up Sentry performance monitoring
- [ ] Add custom performance marks
- [ ] Create performance dashboard
- [ ] Set up alerting for regressions

**Files:**
- New: `.github/workflows/lighthouse.yml`
- New: `lighthouserc.json`
- Modify: Add performance marks in critical paths

---

### 4.2 Additional Optimizations
- [ ] Optimize CSS animations (use transform, will-change)
- [ ] Implement event delegation where beneficial
- [ ] Add tree-shaking audit for icon imports
- [ ] Implement dynamic imports for heavy features (PDF export)
- [ ] Add HTTP caching headers configuration
- [ ] Optimize useEffect dependencies across all components

**Files:**
- Various CSS files
- Event handler components
- Icon import statements throughout

---

### 4.3 Testing & Validation
- [ ] Run full test suite after each phase
- [ ] Perform Lighthouse audits (mobile & desktop)
- [ ] Test on real devices (iOS, Android)
- [ ] Test on slow 3G network
- [ ] Test offline functionality
- [ ] Validate Core Web Vitals
- [ ] A/B test optimizations with real users

---

## Success Metrics

### Phase 1 Targets
- [ ] Initial load time reduced by 20-30%
- [ ] Database query times reduced by 40-50%
- [ ] Search/filter response under 300ms

### Phase 2 Targets
- [ ] Time to Interactive reduced by 40-50%
- [ ] Bundle size reduced by 30-40%
- [ ] Receipt grid render time under 100ms

### Phase 3 Targets
- [ ] Full offline support
- [ ] Image processing doesn't block UI
- [ ] Smooth 60fps scrolling

### Overall Targets
- [ ] Lighthouse Performance Score: 90+
- [ ] LCP (Largest Contentful Paint): < 2.5s
- [ ] FID (First Input Delay): < 100ms
- [ ] CLS (Cumulative Layout Shift): < 0.1
- [ ] Bundle size: < 350KB gzipped

---

## Rollback Procedures

### Before Each Phase:
1. [ ] Create git tag: `git tag pre-perf-phase-[N]`
2. [ ] Document current performance metrics
3. [ ] Create rollback checklist

### If Issues Detected:
1. [ ] Stop implementation immediately
2. [ ] Document the issue
3. [ ] Rollback: `git revert <commit-range>`
4. [ ] Notify team of rollback
5. [ ] Analyze root cause
6. [ ] Create fix plan

---

## Notes

- Each checkbox represents a distinct, testable task
- Test thoroughly after completing each section before moving to next
- Run `npm run build` after each major change
- Monitor bundle size with each change
- Keep performance metrics documented
- Update this document with actual time taken and issues encountered

---

## Current Status: ⏳ Ready to Begin

**Next Action:** Review and approve plan, then start Phase 1.1 (Database Indexes)

**Last Updated:** 2025-10-16
