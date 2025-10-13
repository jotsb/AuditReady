import { useEffect, useState } from 'react';
import { Plus, Upload, CreditCard as Edit, Search, Filter, Calendar, DollarSign, Trash2, Loader2, Eye, CreditCard as Edit2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ReceiptUpload } from '../components/receipts/ReceiptUpload';
import { MultiPageCameraCapture, type CapturedPage } from '../components/receipts/MultiPageCameraCapture';
import { ManualEntryForm } from '../components/receipts/ManualEntryForm';
import { VerifyReceiptModal } from '../components/receipts/VerifyReceiptModal';
import { EditReceiptModal } from '../components/receipts/EditReceiptModal';
import { ReceiptDetailsPage } from './ReceiptDetailsPage';
import { BulkActionToolbar } from '../components/receipts/BulkActionToolbar';
import { BulkCategoryModal } from '../components/receipts/BulkCategoryModal';
import { BulkMoveModal } from '../components/receipts/BulkMoveModal';
import { AdvancedFilterPanel } from '../components/receipts/AdvancedFilterPanel';
import { convertLocalDateToUTC } from '../lib/dateUtils';
import { usePageTracking, useDataLoadTracking } from '../hooks/usePageTracking';
import { actionTracker } from '../lib/actionTracker';

interface Receipt {
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
  is_edited: boolean;
  created_at: string;
  parent_receipt_id: string | null;
  page_number: number;
  is_parent: boolean;
  total_pages: number;
}

interface ReceiptsPageProps {
  quickCaptureAction?: 'photo' | 'upload' | 'manual' | null;
}

export function ReceiptsPage({ quickCaptureAction }: ReceiptsPageProps) {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showMultiPageCamera, setShowMultiPageCamera] = useState(false);
  const [autoTriggerPhoto, setAutoTriggerPhoto] = useState(false);
  const [verifyReceipt, setVerifyReceipt] = useState<{filePath: string, thumbnailPath: string, data: any} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  // Bulk selection state
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);

  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    paymentMethod: '',
    categories: [] as string[],
  });

  usePageTracking('Receipts', { section: 'receipts' });
  const logDataLoad = useDataLoadTracking('receipts');

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      setCurrentPage(1);
      loadReceipts();
    }
  }, [selectedCollection]);

  useEffect(() => {
    if (selectedCollection) {
      loadReceipts();
    }
  }, [currentPage]);

  useEffect(() => {
    if (quickCaptureAction === 'photo') {
      setShowUpload(true);
      setShowManualEntry(false);
      setAutoTriggerPhoto(true);
    } else if (quickCaptureAction === 'upload') {
      setShowUpload(true);
      setShowManualEntry(false);
      setAutoTriggerPhoto(false);
    } else if (quickCaptureAction === 'manual') {
      setShowManualEntry(true);
      setShowUpload(false);
      setAutoTriggerPhoto(false);
    }
  }, [quickCaptureAction]);


  const loadCollections = async () => {
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

      if (!collectionsResult.error && collectionsResult.data && collectionsResult.data.length > 0) {
        setCollections(collectionsResult.data);
        setSelectedCollection(collectionsResult.data[0].id);
      } else {
        setCollections([]);
      }

      if (!businessesResult.error && businessesResult.data) {
        setBusinesses(businessesResult.data);
      } else {
        setBusinesses([]);
      }
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReceipts = async () => {
    if (!selectedCollection) return;

    try {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;

      const { count } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', selectedCollection)
        .eq('extraction_status', 'completed')
        .or('is_parent.eq.true,parent_receipt_id.is.null');

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('collection_id', selectedCollection)
        .eq('extraction_status', 'completed')
        .or('is_parent.eq.true,parent_receipt_id.is.null')
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (error) throw error;
      setReceipts(data || []);
      setTotalCount(count || 0);
      logDataLoad(data?.length || 0, { collectionId: selectedCollection, page: currentPage });
    } catch (error) {
      console.error('Error loading receipts:', error);
    }
  };

  const handleMultiPageUpload = async (files: Array<{ file: File; thumbnail: File }>) => {
    if (!user || !selectedCollection || files.length === 0) return;

    actionTracker.uploadStarted('multi-page-receipt', `${files.length} pages`, 0, { collectionId: selectedCollection });

    setExtracting(true);
    setShowUpload(false);
    setShowMultiPageCamera(false);

    const uploadStartTime = Date.now();

    try {
      const parentReceiptId = crypto.randomUUID();
      const timestamp = Date.now();
      const uploadedPaths: Array<{ filePath: string; thumbnailPath: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const { file, thumbnail } = files[i];
        const fileName = `${user.id}/${parentReceiptId}/page_${i + 1}_${timestamp}.webp`;
        const thumbnailName = `${user.id}/${parentReceiptId}/page_${i + 1}_${timestamp}_thumb.webp`;

        const [uploadResult, thumbnailResult] = await Promise.all([
          supabase.storage.from('receipts').upload(fileName, file, {
            contentType: 'image/webp',
            upsert: false
          }),
          supabase.storage.from('receipts').upload(thumbnailName, thumbnail, {
            contentType: 'image/webp',
            upsert: false
          }),
        ]);

        if (uploadResult.error) throw uploadResult.error;
        if (thumbnailResult.error) throw thumbnailResult.error;

        uploadedPaths.push({ filePath: fileName, thumbnailPath: thumbnailName });
      }

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-receipt-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filePaths: uploadedPaths.map(p => p.filePath),
            collectionId: selectedCollection,
            isMultiPage: true,
            parentReceiptId,
          }),
        }
      );

      console.log('Edge function response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge function error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseText = await response.text();
      console.log('Edge function raw response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response was:', responseText);
        throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }

      console.log('Multi-page extraction result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }

      const transactionDateUTC = result.data.transaction_date
        ? convertLocalDateToUTC(result.data.transaction_date)
        : null;

      const { data: parentReceipt, error: parentError } = await supabase
        .from('receipts')
        .insert({
          id: parentReceiptId,
          collection_id: selectedCollection,
          uploaded_by: user.id,
          file_path: null,
          vendor_name: result.data.vendor_name,
          vendor_address: result.data.vendor_address,
          transaction_date: transactionDateUTC,
          total_amount: parseFloat(result.data.total_amount || 0),
          subtotal: result.data.subtotal ? parseFloat(result.data.subtotal) : null,
          gst_amount: result.data.gst_amount ? parseFloat(result.data.gst_amount) : null,
          pst_amount: result.data.pst_amount ? parseFloat(result.data.pst_amount) : null,
          category: result.data.category,
          payment_method: result.data.payment_method,
          extraction_status: 'completed',
          is_parent: true,
          total_pages: files.length,
          page_number: 1,
          extraction_data: {
            transaction_time: result.data.transaction_time,
            gst_percent: result.data.gst_percent,
            pst_percent: result.data.pst_percent,
            card_last_digits: result.data.card_last_digits,
            customer_name: result.data.customer_name,
          },
        })
        .select()
        .single();

      if (parentError) throw parentError;

      const childRecords = uploadedPaths.map((paths, index) => ({
        collection_id: selectedCollection,
        uploaded_by: user.id,
        parent_receipt_id: parentReceiptId,
        page_number: index + 1,
        file_path: paths.filePath,
        thumbnail_path: paths.thumbnailPath,
        is_parent: false,
        total_pages: files.length,
        extraction_status: 'completed',
      }));

      const { error: childError } = await supabase
        .from('receipts')
        .insert(childRecords);

      if (childError) throw childError;

      const uploadDuration = Date.now() - uploadStartTime;
      actionTracker.uploadCompleted('multi-page-receipt', `${files.length} pages`, uploadDuration, {
        collectionId: selectedCollection,
        vendor: result.data?.vendor_name,
        pageCount: files.length
      });

      await loadReceipts();
      alert(`Successfully uploaded ${files.length}-page receipt!`);
    } catch (error) {
      console.error('Multi-page upload/extraction error:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      alert(`Failed to process multi-page receipt: ${errorMessage}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleMultiPageCameraComplete = async (pages: CapturedPage[]) => {
    await handleMultiPageUpload(
      pages.map((p) => ({
        file: p.file,
        thumbnail: p.thumbnail,
      }))
    );
  };

  const handleUpload = async (file: File, thumbnail: File) => {
    if (!user || !selectedCollection) return;

    actionTracker.uploadStarted('receipt', file.name, file.size, { collectionId: selectedCollection });

    setExtracting(true);
    setShowUpload(false);

    const uploadStartTime = Date.now();

    try {
      const timestamp = Date.now();
      const fileName = `${user.id}/${timestamp}.webp`;
      const thumbnailName = `${user.id}/thumbnails/${timestamp}_thumb.webp`;

      const [uploadResult, thumbnailResult] = await Promise.all([
        supabase.storage.from('receipts').upload(fileName, file, {
          contentType: 'image/webp',
          upsert: false
        }),
        supabase.storage.from('receipts').upload(thumbnailName, thumbnail, {
          contentType: 'image/webp',
          upsert: false
        }),
      ]);

      if (uploadResult.error) throw uploadResult.error;
      if (thumbnailResult.error) throw thumbnailResult.error;

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-receipt-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filePath: fileName,
            collectionId: selectedCollection
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge function error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Extraction result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }

      setVerifyReceipt({
        filePath: fileName,
        thumbnailPath: thumbnailName,
        data: result.data,
      });

      const uploadDuration = Date.now() - uploadStartTime;
      actionTracker.uploadCompleted('receipt', file.name, uploadDuration, {
        collectionId: selectedCollection,
        vendor: result.data?.vendor_name
      });
    } catch (error) {
      console.error('Upload/extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to process receipt: ${errorMessage}`);

      await supabase.storage.from('receipts').remove([fileName]);
    } finally {
      setExtracting(false);
    }
  };

  const handleManualEntry = async (data: any) => {
    if (!user || !selectedCollection) return;

    const { data: receipt, error } = await supabase
      .from('receipts')
      .insert({
        collection_id: selectedCollection,
        uploaded_by: user.id,
        ...data,
        extraction_status: 'completed',
        is_edited: true,
      })
      .select()
      .single();

    if (error) throw error;

    setReceipts([receipt, ...receipts]);
  };

  const handleDelete = async (receiptId: string, filePath: string | null) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    const receipt = receipts.find(r => r.id === receiptId);
    actionTracker.itemDeleted('receipt', receiptId, {
      vendor: receipt?.vendor_name,
      amount: receipt?.total_amount,
      collectionId: selectedCollection
    });

    try {
      if (filePath) {
        await supabase.storage.from('receipts').remove([filePath]);
      }

      const { error } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);

      if (error) throw error;

      setReceipts(receipts.filter(r => r.id !== receiptId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete receipt');
    }
  };

  const handleConfirmExtraction = async (filePath: string, thumbnailPath: string, data: any) => {
    if (!user || !selectedCollection) return;

    const transactionDateUTC = data.transaction_date
      ? convertLocalDateToUTC(data.transaction_date)
      : null;

    const { error } = await supabase
      .from('receipts')
      .insert({
        collection_id: selectedCollection,
        uploaded_by: user.id,
        file_path: filePath,
        thumbnail_path: thumbnailPath,
        file_type: 'image',
        vendor_name: data.vendor_name,
        vendor_address: data.vendor_address,
        transaction_date: transactionDateUTC,
        total_amount: parseFloat(data.total_amount || 0),
        subtotal: data.subtotal ? parseFloat(data.subtotal) : null,
        gst_amount: data.gst_amount ? parseFloat(data.gst_amount) : null,
        pst_amount: data.pst_amount ? parseFloat(data.pst_amount) : null,
        category: data.category,
        payment_method: data.payment_method,
        extraction_status: 'completed',
        extraction_data: {
          transaction_time: data.transaction_time,
          gst_percent: data.gst_percent,
          pst_percent: data.pst_percent,
          card_last_digits: data.card_last_digits,
          customer_name: data.customer_name,
        },
      });

    if (error) throw error;

    setVerifyReceipt(null);
    await loadReceipts();
  };

  const handleCancelExtraction = async (filePath: string) => {
    await supabase.storage.from('receipts').remove([filePath]);
    setVerifyReceipt(null);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    if (query.length >= 3) {
      actionTracker.searchPerformed(query, filteredReceipts.length, { context: 'receipts' });
    }
  };

  const handleCategoryFilterChange = (category: string) => {
    setFilterCategory(category);
    setCurrentPage(1);
    actionTracker.filterApplied('category', category, { context: 'receipts' });
  };

  const handleCollectionChange = (collectionId: string) => {
    actionTracker.selectionChanged('collection', collectionId, selectedCollection, { context: 'receipts' });
    setSelectedCollection(collectionId);
    setCurrentPage(1);
  };

  const handleUploadClick = () => {
    actionTracker.buttonClick('upload_receipt', { collectionId: selectedCollection });
    setShowUpload(true);
  };

  const handleManualEntryClick = () => {
    actionTracker.buttonClick('manual_entry', { collectionId: selectedCollection });
    setShowManualEntry(true);
  };

  const handleEditClick = (receipt: Receipt) => {
    actionTracker.buttonClick('edit_receipt', {
      receiptId: receipt.id,
      vendor: receipt.vendor_name,
      amount: receipt.total_amount
    });
    setEditingReceipt(receipt);
  };

  const handleViewClick = (receiptId: string) => {
    actionTracker.buttonClick('view_receipt_details', { receiptId });
    setSelectedReceiptId(receiptId);
  };

  // Bulk selection handlers
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedReceipts(new Set());
    setSelectAll(false);
  };

  const toggleReceiptSelection = (receiptId: string) => {
    const newSelected = new Set(selectedReceipts);
    if (newSelected.has(receiptId)) {
      newSelected.delete(receiptId);
    } else {
      newSelected.add(receiptId);
    }
    setSelectedReceipts(newSelected);
    setSelectAll(newSelected.size === filteredReceipts.length && filteredReceipts.length > 0);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedReceipts(new Set());
      setSelectAll(false);
    } else {
      setSelectedReceipts(new Set(filteredReceipts.map(r => r.id)));
      setSelectAll(true);
    }
  };

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedReceipts.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedReceipts.size} receipt(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    const startTime = Date.now();
    const receiptIds = Array.from(selectedReceipts);

    try {
      // Get file paths for storage cleanup
      const { data: receiptsToDelete } = await supabase
        .from('receipts')
        .select('id, file_path, vendor_name, total_amount')
        .in('id', receiptIds);

      // Delete from database (triggers will handle audit logs)
      const { error } = await supabase
        .from('receipts')
        .delete()
        .in('id', receiptIds);

      if (error) throw error;

      // Delete files from storage
      const filePaths = receiptsToDelete
        ?.filter(r => r.file_path)
        .map(r => r.file_path) || [];

      if (filePaths.length > 0) {
        await supabase.storage.from('receipts').remove(filePaths);
      }

      // System logging
      await supabase.from('system_logs').insert({
        level: 'INFO',
        category: 'USER_ACTION',
        message: `Bulk deleted ${receiptIds.length} receipts`,
        metadata: {
          user_id: user?.id,
          collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          execution_time_ms: Date.now() - startTime,
          action: 'bulk_delete'
        }
      });

      // Reload receipts
      await loadReceipts();

      // Clear selection
      setSelectedReceipts(new Set());
      setIsSelectMode(false);
      setSelectAll(false);

      alert(`Successfully deleted ${receiptIds.length} receipt(s)`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Failed to delete receipts. Please try again.');

      // Log error
      await supabase.from('system_logs').insert({
        level: 'ERROR',
        category: 'USER_ACTION',
        message: `Bulk delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          user_id: user?.id,
          collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          error: error instanceof Error ? error.message : String(error),
          action: 'bulk_delete'
        }
      });
    }
  };

  const handleBulkCategorize = async (category: string) => {
    const receiptIds = Array.from(selectedReceipts);
    const startTime = Date.now();

    try {
      const { error } = await supabase
        .from('receipts')
        .update({ category, is_edited: true })
        .in('id', receiptIds);

      if (error) throw error;

      // System logging
      await supabase.from('system_logs').insert({
        level: 'INFO',
        category: 'USER_ACTION',
        message: `Bulk categorized ${receiptIds.length} receipts as "${category}"`,
        metadata: {
          user_id: user?.id,
          collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          category,
          execution_time_ms: Date.now() - startTime,
          action: 'bulk_categorize'
        }
      });

      await loadReceipts();
      setSelectedReceipts(new Set());
      setIsSelectMode(false);
      setSelectAll(false);

      alert(`Successfully categorized ${receiptIds.length} receipt(s)`);
    } catch (error) {
      console.error('Bulk categorize error:', error);
      alert('Failed to categorize receipts. Please try again.');

      await supabase.from('system_logs').insert({
        level: 'ERROR',
        category: 'USER_ACTION',
        message: `Bulk categorize failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          user_id: user?.id,
          collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          category,
          error: error instanceof Error ? error.message : String(error),
          action: 'bulk_categorize'
        }
      });
    }
  };

  const handleBulkMove = async (targetCollectionId: string) => {
    const receiptIds = Array.from(selectedReceipts);
    const startTime = Date.now();

    try {
      const { error } = await supabase
        .from('receipts')
        .update({ collection_id: targetCollectionId })
        .in('id', receiptIds);

      if (error) throw error;

      // System logging
      await supabase.from('system_logs').insert({
        level: 'INFO',
        category: 'USER_ACTION',
        message: `Bulk moved ${receiptIds.length} receipts to different collection`,
        metadata: {
          user_id: user?.id,
          from_collection_id: selectedCollection,
          to_collection_id: targetCollectionId,
          receipt_count: receiptIds.length,
          execution_time_ms: Date.now() - startTime,
          action: 'bulk_move'
        }
      });

      await loadReceipts();
      setSelectedReceipts(new Set());
      setIsSelectMode(false);
      setSelectAll(false);

      alert(`Successfully moved ${receiptIds.length} receipt(s)`);
    } catch (error) {
      console.error('Bulk move error:', error);
      alert('Failed to move receipts. Please try again.');

      await supabase.from('system_logs').insert({
        level: 'ERROR',
        category: 'USER_ACTION',
        message: `Bulk move failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          user_id: user?.id,
          from_collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          error: error instanceof Error ? error.message : String(error),
          action: 'bulk_move'
        }
      });
    }
  };

  const handleBulkExportCSV = async () => {
    const receiptIds = Array.from(selectedReceipts);
    if (receiptIds.length === 0) return;

    try {
      const { data: receiptsToExport, error } = await supabase
        .from('receipts')
        .select('*')
        .in('id', receiptIds)
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      // Generate CSV content with comprehensive fields
      const headers = [
        'Transaction Date',
        'Vendor Name',
        'Vendor Address',
        'Category',
        'Payment Method',
        'Subtotal',
        'GST',
        'PST',
        'Total Amount',
        'Notes',
        'Extraction Status',
        'Edited',
        'Created Date',
        'Receipt ID'
      ];
      const csvRows = [headers.join(',')];

      receiptsToExport?.forEach((receipt) => {
        const row = [
          receipt.transaction_date || '',
          `"${(receipt.vendor_name || '').replace(/"/g, '""')}"`,
          `"${(receipt.vendor_address || '').replace(/"/g, '""')}"`,
          receipt.category || '',
          receipt.payment_method || '',
          receipt.subtotal?.toFixed(2) || '0.00',
          receipt.gst_amount?.toFixed(2) || '0.00',
          receipt.pst_amount?.toFixed(2) || '0.00',
          receipt.total_amount?.toFixed(2) || '0.00',
          `"${(receipt.notes || '').replace(/"/g, '""')}"`,
          receipt.extraction_status || '',
          receipt.is_edited ? 'Yes' : 'No',
          receipt.created_at?.split('T')[0] || '',
          receipt.id
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipts-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // System logging
      await supabase.from('system_logs').insert({
        level: 'INFO',
        category: 'USER_ACTION',
        message: `Bulk exported ${receiptIds.length} receipts to CSV`,
        metadata: {
          user_id: user?.id,
          collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          action: 'bulk_export_csv'
        }
      });

      alert(`Successfully exported ${receiptIds.length} receipt(s) to CSV`);
    } catch (error) {
      console.error('Bulk export CSV error:', error);
      alert('Failed to export receipts. Please try again.');
    }
  };

  const handleBulkExportPDF = async () => {
    const receiptIds = Array.from(selectedReceipts);
    if (receiptIds.length === 0) return;

    try {
      // Dynamically import jsPDF and autoTable
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      // Get full receipt data from database
      const { data: receiptsToExport, error } = await supabase
        .from('receipts')
        .select('*')
        .in('id', receiptIds)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      if (!receiptsToExport || receiptsToExport.length === 0) {
        throw new Error('No receipts found to export');
      }

      // Create PDF document in landscape orientation
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Receipt Export Report', 14, 15);

      // Add metadata
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 14, 22);
      doc.text(`Total Receipts: ${receiptsToExport.length}`, 14, 27);

      // Calculate totals
      const totalAmount = receiptsToExport.reduce((sum, r) => sum + (r.total_amount || 0), 0);
      const totalSubtotal = receiptsToExport.reduce((sum, r) => sum + (r.subtotal || 0), 0);
      const totalGST = receiptsToExport.reduce((sum, r) => sum + (r.gst_amount || 0), 0);
      const totalPST = receiptsToExport.reduce((sum, r) => sum + (r.pst_amount || 0), 0);

      doc.text(`Subtotal: $${totalSubtotal.toFixed(2)} | GST: $${totalGST.toFixed(2)} | PST: $${totalPST.toFixed(2)} | Total: $${totalAmount.toFixed(2)}`, 14, 32);

      // Prepare comprehensive table data
      const tableData = receiptsToExport.map(receipt => [
        formatDate(receipt.transaction_date),
        receipt.vendor_name || 'Unknown',
        receipt.vendor_address || '',
        receipt.category || 'Uncategorized',
        receipt.payment_method || '-',
        `$${(receipt.subtotal || 0).toFixed(2)}`,
        `$${(receipt.gst_amount || 0).toFixed(2)}`,
        `$${(receipt.pst_amount || 0).toFixed(2)}`,
        `$${(receipt.total_amount || 0).toFixed(2)}`,
        receipt.is_edited ? 'Yes' : 'No',
        receipt.notes || ''
      ]);

      // Add comprehensive table with landscape layout
      autoTable(doc, {
        startY: 38,
        head: [[
          'Date',
          'Vendor',
          'Address',
          'Category',
          'Payment',
          'Subtotal',
          'GST',
          'PST',
          'Total',
          'Edited',
          'Notes'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'left' },    // Date
          1: { cellWidth: 35, halign: 'left' },    // Vendor
          2: { cellWidth: 40, halign: 'left', fontSize: 6 },    // Address
          3: { cellWidth: 25, halign: 'left' },    // Category
          4: { cellWidth: 20, halign: 'center' },  // Payment
          5: { cellWidth: 20, halign: 'right' },   // Subtotal
          6: { cellWidth: 18, halign: 'right' },   // GST
          7: { cellWidth: 18, halign: 'right' },   // PST
          8: { cellWidth: 20, halign: 'right' },   // Total
          9: { cellWidth: 15, halign: 'center' },  // Edited
          10: { cellWidth: 44, halign: 'left', fontSize: 6 }   // Notes
        },
        margin: { left: 14, right: 14 }
      });

      // Save the PDF
      doc.save(`receipts-export-${new Date().toISOString().split('T')[0]}.pdf`);

      // System logging
      await supabase.from('system_logs').insert({
        level: 'INFO',
        category: 'USER_ACTION',
        message: `Bulk exported ${receiptIds.length} receipts to PDF`,
        metadata: {
          user_id: user?.id,
          collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          total_amount: totalAmount,
          action: 'bulk_export_pdf'
        }
      });

      alert(`Successfully exported ${receiptIds.length} receipt(s) to PDF`);
    } catch (error) {
      console.error('Bulk export PDF error:', error);
      alert('Failed to export receipts to PDF. Please try again.');

      await supabase.from('system_logs').insert({
        level: 'ERROR',
        category: 'USER_ACTION',
        message: `Bulk PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          user_id: user?.id,
          collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          error: error instanceof Error ? error.message : String(error),
          action: 'bulk_export_pdf'
        }
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredReceipts = receipts.filter((receipt) => {
    // Basic search
    const matchesSearch =
      !searchQuery ||
      receipt.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.category?.toLowerCase().includes(searchQuery.toLowerCase());

    // Legacy category filter (keep for backwards compatibility)
    const matchesCategory = !filterCategory || receipt.category === filterCategory;

    // Advanced filters
    const matchesDateFrom = !advancedFilters.dateFrom ||
      (receipt.transaction_date && receipt.transaction_date >= advancedFilters.dateFrom);

    const matchesDateTo = !advancedFilters.dateTo ||
      (receipt.transaction_date && receipt.transaction_date <= advancedFilters.dateTo);

    const matchesAmountMin = !advancedFilters.amountMin ||
      receipt.total_amount >= parseFloat(advancedFilters.amountMin);

    const matchesAmountMax = !advancedFilters.amountMax ||
      receipt.total_amount <= parseFloat(advancedFilters.amountMax);

    const matchesPaymentMethod = !advancedFilters.paymentMethod ||
      receipt.payment_method === advancedFilters.paymentMethod;

    const matchesCategories = advancedFilters.categories.length === 0 ||
      (receipt.category && advancedFilters.categories.includes(receipt.category));

    return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo &&
           matchesAmountMin && matchesAmountMax && matchesPaymentMethod && matchesCategories;
  });

  if (selectedReceiptId) {
    return (
      <ReceiptDetailsPage
        receiptId={selectedReceiptId}
        onBack={() => setSelectedReceiptId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-600 dark:text-gray-400">Loading receipts...</div>
      </div>
    );
  }

  if (collections.length === 0) {
    const hasBusiness = businesses.length > 0;

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-slate-200 dark:border-gray-700 p-8">
          <div className="mb-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
              {hasBusiness ? 'No Collections Found' : 'Getting Started'}
            </h3>
            <p className="text-slate-600 dark:text-gray-400 mb-6">
              {hasBusiness
                ? 'You need to create a collection before you can start managing receipts.'
                : 'Before you can manage receipts, you need to set up your business and create a collection.'
              }
            </p>
          </div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('navigate-to-settings', {
                detail: { section: hasBusiness ? 'collections' : 'business' }
              }));
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus size={20} />
            {hasBusiness ? 'Create Collection' : 'Set Up Business'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Collection</label>
            <select
              value={selectedCollection}
              onChange={(e) => handleCollectionChange(e.target.value)}
              className="w-full md:w-auto px-4 py-2 border border-slate-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.businesses?.name} - {col.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleSelectMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                isSelectMode
                  ? 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
                  : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600'
              }`}
            >
              <CheckSquare size={20} />
              <span>{isSelectMode ? 'Cancel' : 'Select'}</span>
            </button>
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Upload size={20} />
              <span>Upload</span>
            </button>
            <button
              onClick={handleManualEntryClick}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
            >
              <Edit size={20} />
              <span>Manual Entry</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search receipts..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500" />
            <select
              value={filterCategory}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
              className="w-full md:w-auto pl-10 pr-8 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Categories</option>
              <option value="Meals & Entertainment">Meals & Entertainment</option>
              <option value="Transportation">Transportation</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>

          <button
            onClick={() => setShowAdvancedFilters(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 transition"
          >
            <Filter size={20} />
            <span>Advanced</span>
            {(advancedFilters.dateFrom || advancedFilters.dateTo || advancedFilters.amountMin ||
              advancedFilters.amountMax || advancedFilters.paymentMethod || advancedFilters.categories.length > 0) && (
              <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                Active
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-gray-800 border-b border-slate-200">
              <tr>
                {isSelectMode && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={toggleSelectAll}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-gray-700 rounded transition"
                    >
                      {selectAll ? (
                        <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square size={20} className="text-slate-400 dark:text-gray-500" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {filteredReceipts.map((receipt) => (
                <tr
                  key={receipt.id}
                  className={`hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition ${
                    isSelectMode ? 'cursor-default' : 'cursor-pointer'
                  } ${selectedReceipts.has(receipt.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onClick={(e) => {
                    if (!isSelectMode && !(e.target as HTMLElement).closest('button')) {
                      handleViewClick(receipt.id);
                    }
                  }}
                >
                  {isSelectMode && (
                    <td className="px-4 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReceiptSelection(receipt.id);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-gray-700 rounded transition"
                      >
                        {selectedReceipts.has(receipt.id) ? (
                          <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square size={20} className="text-slate-400 dark:text-gray-500" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-800 dark:text-white">
                          {receipt.vendor_name || 'Unknown Vendor'}
                        </div>
                        {receipt.vendor_address && (
                          <div className="text-xs text-slate-500 dark:text-gray-400">{receipt.vendor_address}</div>
                        )}
                      </div>
                      {receipt.total_pages > 1 && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium" title={`This receipt has ${receipt.total_pages} pages`}>
                          {receipt.total_pages} pages
                        </span>
                      )}
                      {receipt.is_edited && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium" title="This receipt has been manually edited">
                          Edited
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-gray-300">
                      <Calendar size={14} />
                      <span>{formatDate(receipt.transaction_date)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {receipt.category ? (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                        {receipt.category}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-gray-500">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-600 dark:text-gray-300 capitalize">
                      {receipt.payment_method || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1 text-sm font-semibold text-slate-800 dark:text-white">
                      <DollarSign size={16} />
                      <span>{receipt.total_amount.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewClick(receipt.id);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(receipt);
                        }}
                        className="p-2 text-slate-600 hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg transition"
                        title="Edit receipt"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(receipt.id, receipt.file_path);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete receipt"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReceipts.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-gray-400">
            {receipts.length === 0 ? 'No receipts yet. Upload your first receipt!' : 'No receipts match your filters.'}
          </div>
        )}

        {totalCount > itemsPerPage && (
          <div className="flex flex-col items-center gap-3 px-6 py-4 border-t border-slate-200">
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(totalCount / itemsPerPage) }, (_, i) => i + 1)
                  .filter(page => {
                    const totalPages = Math.ceil(totalCount / itemsPerPage);
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                    return false;
                  })
                  .map((page, index, array) => {
                    const showEllipsis = index > 0 && page - array[index - 1] > 1;
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsis && <span className="px-2 text-slate-400 dark:text-gray-500">...</span>}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-slate-600 dark:text-gray-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} receipts
            </div>
          </div>
        )}
      </div>

      {showUpload && !extracting && (
        <ReceiptUpload
          onUpload={handleUpload}
          onMultiPageUpload={handleMultiPageUpload}
          onClose={() => {
            setShowUpload(false);
            setAutoTriggerPhoto(false);
          }}
          autoTriggerPhoto={autoTriggerPhoto}
        />
      )}

      {showMultiPageCamera && !extracting && (
        <MultiPageCameraCapture
          onComplete={handleMultiPageCameraComplete}
          onCancel={() => setShowMultiPageCamera(false)}
        />
      )}

      {extracting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4">
            <Loader2 size={48} className="text-blue-600 animate-spin" />
            <p className="text-lg font-medium text-slate-800 dark:text-white">Extracting receipt data...</p>
            <p className="text-sm text-slate-600 dark:text-gray-400">This may take a moment</p>
          </div>
        </div>
      )}

      {showManualEntry && (
        <ManualEntryForm onSubmit={handleManualEntry} onClose={() => setShowManualEntry(false)} />
      )}

      {verifyReceipt && (
        <VerifyReceiptModal
          receiptId={verifyReceipt.filePath}
          extractedData={verifyReceipt.data}
          onConfirm={(filePath, data) => handleConfirmExtraction(verifyReceipt.filePath, verifyReceipt.thumbnailPath, data)}
          onClose={() => handleCancelExtraction(verifyReceipt.filePath)}
        />
      )}

      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSave={() => {
            setEditingReceipt(null);
            loadReceipts();
          }}
        />
      )}

      <BulkActionToolbar
        selectedCount={selectedReceipts.size}
        onDelete={handleBulkDelete}
        onCategorize={() => setShowBulkCategoryModal(true)}
        onMove={() => setShowBulkMoveModal(true)}
        onExportCSV={handleBulkExportCSV}
        onExportPDF={handleBulkExportPDF}
        onCancel={toggleSelectMode}
      />

      {showBulkCategoryModal && (
        <BulkCategoryModal
          selectedCount={selectedReceipts.size}
          onConfirm={handleBulkCategorize}
          onClose={() => setShowBulkCategoryModal(false)}
        />
      )}

      {showBulkMoveModal && (
        <BulkMoveModal
          selectedCount={selectedReceipts.size}
          currentCollectionId={selectedCollection}
          onConfirm={handleBulkMove}
          onClose={() => setShowBulkMoveModal(false)}
        />
      )}

      {showAdvancedFilters && (
        <AdvancedFilterPanel
          filters={advancedFilters}
          onChange={setAdvancedFilters}
          onClear={() => setAdvancedFilters({
            dateFrom: '',
            dateTo: '',
            amountMin: '',
            amountMax: '',
            paymentMethod: '',
            categories: [],
          })}
          onClose={() => setShowAdvancedFilters(false)}
          categories={['Meals & Entertainment', 'Transportation', 'Office Supplies', 'Miscellaneous']}
        />
      )}
    </div>
  );
}
