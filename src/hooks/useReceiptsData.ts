import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const loadCollections = async () => {
    try {
      logger.info('Starting collection load', { hook: 'useReceiptsData' });

      const [collectionsResult, businessesResult] = await Promise.all([
        supabase
          .from('collections')
          .select('*, businesses(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('businesses')
          .select('id, name')
      ]);

      logger.info('Collection query result', {
        hasError: !!collectionsResult.error,
        error: collectionsResult.error,
        dataLength: collectionsResult.data?.length || 0,
        rawData: collectionsResult.data,
        hook: 'useReceiptsData'
      });

      logger.info('Business query result', {
        hasError: !!businessesResult.error,
        error: businessesResult.error,
        dataLength: businessesResult.data?.length || 0,
        hook: 'useReceiptsData'
      });

      if (collectionsResult.error) {
        logger.error('Collections query error', collectionsResult.error, {
          hook: 'useReceiptsData',
          errorCode: collectionsResult.error.code,
          errorMessage: collectionsResult.error.message
        });
        setCollections([]);
      } else if (collectionsResult.data && collectionsResult.data.length > 0) {
        logger.info('Setting collections state', {
          count: collectionsResult.data.length,
          firstCollection: collectionsResult.data[0],
          hook: 'useReceiptsData'
        });
        setCollections(collectionsResult.data);
      } else {
        logger.warn('No collections found', { hook: 'useReceiptsData' });
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

      logger.info('Collections and businesses loaded', {
        collectionCount: collectionsResult.data?.length || 0,
        businessCount: businessesResult.data?.length || 0,
        hook: 'useReceiptsData'
      });
    } catch (error) {
      logger.error('Failed to load collections - exception thrown', error as Error, {
        hook: 'useReceiptsData'
      });
      setCollections([]);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReceipts = async (page: number = 1, itemsPerPage: number = 20) => {
    if (!selectedCollection) return;

    try {
      setLoading(true);
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage - 1;

      const { data: receiptsData, error: receiptsError, count } = await supabase
        .from('receipts')
        .select('*', { count: 'exact' })
        .eq('collection_id', selectedCollection)
        .eq('extraction_status', 'completed')
        .is('deleted_at', null)
        .or('is_parent.eq.true,parent_receipt_id.is.null')
        .order('created_at', { ascending: false })
        .range(start, end);

      if (receiptsError) throw receiptsError;

      const parentReceiptIds = (receiptsData || [])
        .filter(r => r.is_parent && r.total_pages > 1 && !r.thumbnail_path)
        .map(r => r.id);

      let firstPagesMap = new Map<string, { thumbnail_path: string | null; file_path: string | null }>();

      if (parentReceiptIds.length > 0) {
        const { data: firstPages } = await supabase
          .from('receipts')
          .select('parent_receipt_id, thumbnail_path, file_path')
          .in('parent_receipt_id', parentReceiptIds)
          .eq('page_number', 1);

        if (firstPages) {
          firstPages.forEach(page => {
            if (page.parent_receipt_id) {
              firstPagesMap.set(page.parent_receipt_id, {
                thumbnail_path: page.thumbnail_path,
                file_path: page.file_path
              });
            }
          });
        }
      }

      const receiptsWithThumbnails = (receiptsData || []).map(receipt => {
        if (receipt.is_parent && receipt.total_pages > 1 && !receipt.thumbnail_path) {
          const firstPage = firstPagesMap.get(receipt.id);
          return {
            ...receipt,
            thumbnail_path: firstPage?.thumbnail_path || null,
            file_path: firstPage?.file_path || receipt.file_path
          };
        }
        return receipt;
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
      setLoading(false);
    }
  };

  const reloadReceipts = () => loadReceipts(1, 20);

  return {
    receipts,
    collections,
    businesses,
    loading,
    totalCount,
    loadCollections,
    loadReceipts,
    reloadReceipts,
    setReceipts
  };
}
