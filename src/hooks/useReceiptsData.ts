import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLogger } from './useLogger';
import { useDataLoadTracking } from './usePageTracking';

export interface Receipt {
  id: string;
  collection_id: string;
  vendor_name: string | null;
  vendor_address: string | null;
  transaction_date: string | null;
  subtotal: number | null;
  gst_amount: number;
  pst_amount: number;
  total_amount: number;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
  extraction_status: string | null;
  extracted_data: any | null;
  file_path: string | null;
  thumbnail_path: string | null;
  source: string | null;
  is_edited: boolean;
  created_at: string;
  parent_receipt_id: string | null;
  page_number: number;
  is_parent: boolean;
  total_pages: number;
}

export interface Collection {
  id: string;
  name: string;
  businesses?: { name: string };
}

export interface Business {
  id: string;
  name: string;
}

export function useReceiptsData(selectedCollection: string) {
  const logger = useLogger();
  const logDataLoad = useDataLoadTracking('receipts');

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const pendingCollectionRef = useRef<string | null>(null);

  const loading = collectionsLoading || receiptsLoading;

  const loadReceipts = useCallback(async (collectionId: string, page: number = 1, itemsPerPage: number = 20) => {
    if (!collectionId) return;

    try {
      setReceiptsLoading(true);
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      const { data: receiptsData, error: receiptsError, count } = await supabase
        .from('receipts')
        .select(`
          *,
          first_page:receipts!parent_receipt_id(thumbnail_path, file_path)
        `, { count: 'exact' })
        .eq('collection_id', collectionId)
        .eq('extraction_status', 'completed')
        .is('deleted_at', null)
        .or('is_parent.eq.true,parent_receipt_id.is.null')
        .order('created_at', { ascending: false })
        .range(start, end);

      if (receiptsError) throw receiptsError;

      const receiptsWithThumbnails = (receiptsData || []).map((receipt: any) => {
        if (receipt.is_parent && receipt.total_pages > 1 && !receipt.thumbnail_path && receipt.first_page && receipt.first_page.length > 0) {
          const firstPage = receipt.first_page[0];
          const { first_page, ...receiptData } = receipt;
          return {
            ...receiptData,
            thumbnail_path: firstPage?.thumbnail_path || null,
            file_path: firstPage?.file_path || receiptData.file_path
          };
        }
        const { first_page, ...receiptData } = receipt;
        return receiptData;
      });

      setReceipts(receiptsWithThumbnails);
      setTotalCount(count || 0);

      logDataLoad(receiptsWithThumbnails.length);
      logger.info('Receipts loaded', {
        count: receiptsWithThumbnails.length,
        page,
        total: count || 0
      });
    } catch (error) {
      logger.error('Failed to load receipts', error as Error);
      setReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  }, [logger, logDataLoad]);

  const loadCollections = useCallback(async () => {
    try {
      const [collectionsResult, businessesResult] = await Promise.all([
        supabase
          .from('collections')
          .select('*, businesses(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('businesses')
          .select('id, name')
      ]);

      if (collectionsResult.error) {
        logger.error('Collections query error', collectionsResult.error, {
          hook: 'useReceiptsData',
          errorCode: collectionsResult.error.code,
          errorMessage: collectionsResult.error.message
        });
        setCollections([]);
      } else if (collectionsResult.data && collectionsResult.data.length > 0) {
        setCollections(collectionsResult.data);

        const firstId = collectionsResult.data[0].id;
        pendingCollectionRef.current = firstId;

        loadReceipts(firstId, 1, 20);
      } else {
        setCollections([]);
      }

      if (businessesResult.error) {
        logger.error('Businesses query error', businessesResult.error, {
          hook: 'useReceiptsData'
        });
        setBusinesses([]);
      } else if (businessesResult.data) {
        setBusinesses(businessesResult.data);
      } else {
        setBusinesses([]);
      }
    } catch (error) {
      logger.error('Failed to load collections', error as Error, {
        hook: 'useReceiptsData'
      });
      setCollections([]);
      setBusinesses([]);
    } finally {
      setCollectionsLoading(false);
    }
  }, [logger, loadReceipts]);

  const loadReceiptsForPage = useCallback((page: number = 1, itemsPerPage: number = 20) => {
    loadReceipts(selectedCollection, page, itemsPerPage);
  }, [selectedCollection, loadReceipts]);

  const reloadReceipts = useCallback(() => loadReceipts(selectedCollection, 1, 20), [selectedCollection, loadReceipts]);

  const getPendingCollection = useCallback(() => {
    const val = pendingCollectionRef.current;
    pendingCollectionRef.current = null;
    return val;
  }, []);

  return {
    receipts,
    collections,
    businesses,
    loading,
    collectionsLoading,
    receiptsLoading,
    totalCount,
    loadCollections,
    loadReceipts: loadReceiptsForPage,
    reloadReceipts,
    setReceipts,
    getPendingCollection
  };
}
