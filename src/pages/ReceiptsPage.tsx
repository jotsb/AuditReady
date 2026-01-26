import { useEffect, useState } from 'react';
import { Plus, Loader2, Eye, CreditCard as Edit2, CheckSquare, Square, Camera, Calendar, DollarSign, Trash2, Mail } from 'lucide-react';
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
import { ReceiptsHeader } from '../components/receipts/ReceiptsHeader';
import { ReceiptThumbnail } from '../components/shared/ReceiptThumbnail';
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard';
import { useReceiptsData, type Receipt } from '../hooks/useReceiptsData';
import { useReceiptFilters } from '../hooks/useReceiptFilters';
import { useReceiptSelection } from '../hooks/useReceiptSelection';
import { usePageTracking } from '../hooks/usePageTracking';
import { actionTracker } from '../lib/actionTracker';
import { useLogger } from '../hooks/useLogger';
import { convertLocalDateToUTC, formatDateForDisplay } from '../lib/dateUtils';
import * as receiptService from '../services/receiptService';

interface ReceiptsPageProps {
  quickCaptureAction?: 'photo' | 'upload' | 'manual' | null;
  onQuickCaptureComplete?: () => void;
}

export function ReceiptsPage({ quickCaptureAction, onQuickCaptureComplete }: ReceiptsPageProps) {
  const { user } = useAuth();
  const logger = useLogger();

  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { receipts, collections, businesses, loading, totalCount, loadCollections, loadReceipts, reloadReceipts, setReceipts } = useReceiptsData(selectedCollection);
  const { searchQuery, filterCategory, advancedFilters, filteredReceipts, handleSearchChange, handleCategoryFilterChange, setAdvancedFilters, clearAdvancedFilters } = useReceiptFilters(receipts);
  const { selectedReceipts, isSelectMode, selectAll, toggleSelectMode, toggleReceiptSelection, toggleSelectAll, clearSelection } = useReceiptSelection(filteredReceipts);

  const [showUpload, setShowUpload] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showMultiPageCamera, setShowMultiPageCamera] = useState(false);
  const [autoTriggerPhoto, setAutoTriggerPhoto] = useState(false);
  const [verifyReceipt, setVerifyReceipt] = useState<{
    filePath: string;
    thumbnailPath: string;
    data: any;
    isMultiPage?: boolean;
    multiPageData?: {
      parentReceiptId: string;
      uploadedPaths: Array<{ filePath: string; thumbnailPath: string }>;
      pageCount: number;
    };
  } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  usePageTracking('Receipts', { section: 'receipts' });

  useEffect(() => {
    logger.info('ReceiptsPage mounting - loading collections', {
      page: 'ReceiptsPage',
      operation: 'component_mount'
    });

    loadCollections();
  }, []);

  useEffect(() => {
    logger.info('Collections state updated', {
      collectionsCount: collections.length,
      currentSelectedCollection: selectedCollection,
      firstCollectionId: collections.length > 0 ? collections[0].id : null,
      page: 'ReceiptsPage',
      operation: 'collections_state_updated'
    });

    if (collections.length > 0 && !selectedCollection) {
      logger.info('Auto-selecting first collection', {
        collectionId: collections[0].id,
        collectionName: collections[0].name,
        page: 'ReceiptsPage',
        operation: 'auto_select_collection'
      });
      setSelectedCollection(collections[0].id);
    }
  }, [collections]);

  useEffect(() => {
    logger.info('selectedCollection changed', {
      selectedCollection,
      hasSelectedCollection: !!selectedCollection,
      currentPage,
      collectionsCount: collections.length,
      page: 'ReceiptsPage',
      operation: 'selected_collection_changed'
    });

    if (selectedCollection) {
      loadReceipts(currentPage, itemsPerPage);
    }
  }, [selectedCollection, currentPage]);

  useEffect(() => {
    logger.info('quickCaptureAction changed', {
      quickCaptureAction,
      selectedCollection,
      hasSelectedCollection: !!selectedCollection,
      collectionsCount: collections.length,
      page: 'ReceiptsPage',
      operation: 'quick_capture_action_changed'
    });

    if (quickCaptureAction === 'photo') {
      setShowMultiPageCamera(true);
      setShowUpload(false);
      setShowManualEntry(false);
      setAutoTriggerPhoto(false);
    } else if (quickCaptureAction === 'upload') {
      setShowUpload(true);
      setShowManualEntry(false);
      setShowMultiPageCamera(false);
      setAutoTriggerPhoto(false);
    } else if (quickCaptureAction === 'manual') {
      setShowManualEntry(true);
      setShowUpload(false);
      setShowMultiPageCamera(false);
      setAutoTriggerPhoto(false);
    }
  }, [quickCaptureAction]);

  const handleMultiPageUpload = async (files: Array<{ file: File; thumbnail: File }>) => {
    if (!user || !selectedCollection || files.length === 0) return;

    logger.info('Multi-page upload started', {
      pageCount: files.length,
      collectionId: selectedCollection,
      userId: user.id,
      page: 'ReceiptsPage'
    });

    actionTracker.uploadStarted('multi-page-receipt', `${files.length} pages`, 0, { collectionId: selectedCollection });

    setExtracting(true);
    setShowUpload(false);
    setShowMultiPageCamera(false);

    try {
      const parentReceiptId = crypto.randomUUID();
      const timestamp = Date.now();
      const uploadedPaths: Array<{ filePath: string; thumbnailPath: string }> = [];

      logger.info('Uploading multi-page receipt files', {
        parentReceiptId,
        pageCount: files.length,
        page: 'ReceiptsPage'
      });

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

        if (uploadResult.error) {
          logger.error('Failed to upload page image', uploadResult.error as Error, {
            pageNumber: i + 1,
            fileName,
            parentReceiptId,
            page: 'ReceiptsPage'
          });
          throw uploadResult.error;
        }
        if (thumbnailResult.error) {
          logger.error('Failed to upload thumbnail', thumbnailResult.error as Error, {
            pageNumber: i + 1,
            thumbnailName,
            parentReceiptId,
            page: 'ReceiptsPage'
          });
          throw thumbnailResult.error;
        }

        logger.info('Uploaded page files', {
          pageNumber: i + 1,
          fileName,
          thumbnailName,
          page: 'ReceiptsPage'
        });

        uploadedPaths.push({ filePath: fileName, thumbnailPath: thumbnailName });
      }

      logger.info('All pages uploaded, calling extraction function', {
        parentReceiptId,
        pageCount: files.length,
        page: 'ReceiptsPage'
      });

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

      logger.info('Edge function response received', {
        status: response.status,
        parentReceiptId,
        page: 'ReceiptsPage'
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Edge function returned error', new Error(`HTTP ${response.status}`), {
          status: response.status,
          errorText,
          parentReceiptId,
          page: 'ReceiptsPage'
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        logger.error('Failed to parse JSON response', parseError as Error, {
          responseText: responseText.substring(0, 500),
          parentReceiptId,
          page: 'ReceiptsPage'
        });
        throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }

      logger.info('Multi-page extraction result parsed', {
        success: result.success,
        hasData: !!result.data,
        parentReceiptId,
        page: 'ReceiptsPage'
      });

      if (!result.success) {
        logger.error('Extraction failed', new Error(result.error || 'Extraction failed'), {
          resultError: result.error,
          parentReceiptId,
          page: 'ReceiptsPage'
        });
        throw new Error(result.error || 'Extraction failed');
      }

      logger.info('Opening verification modal with multi-page extracted data', {
        vendor: result.data?.vendor_name,
        amount: result.data?.total_amount,
        parentReceiptId,
        pageCount: files.length,
        page: 'ReceiptsPage'
      });

      setVerifyReceipt({
        filePath: uploadedPaths[0].filePath,
        thumbnailPath: uploadedPaths[0].thumbnailPath,
        data: result.data,
        isMultiPage: true,
        multiPageData: {
          parentReceiptId,
          uploadedPaths,
          pageCount: files.length,
        },
      });
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      logger.error('Multi-page upload failed', error as Error, {
        errorMessage,
        errorType: typeof error,
        collectionId: selectedCollection,
        pageCount: files.length,
        page: 'ReceiptsPage',
        operation: 'multi_page_upload'
      });

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
    logger.info('handleUpload called', {
      hasUser: !!user,
      userId: user?.id,
      selectedCollection,
      hasSelectedCollection: !!selectedCollection,
      collectionsCount: collections.length,
      fileName: file.name,
      page: 'ReceiptsPage',
      operation: 'handle_upload_entry'
    });

    if (!user || !selectedCollection) {
      logger.error('handleUpload aborted - missing required data', new Error('Missing user or selectedCollection'), {
        hasUser: !!user,
        userId: user?.id,
        selectedCollection,
        hasSelectedCollection: !!selectedCollection,
        collectionsCount: collections.length,
        fileName: file.name,
        page: 'ReceiptsPage',
        operation: 'handle_upload_aborted'
      });
      alert('Cannot upload receipt: No collection selected. Please select a collection and try again.');
      return;
    }

    // Get collection and business info for logging
    const currentCollection = collections.find(c => c.id === selectedCollection);
    const currentBusiness = currentCollection ? businesses.find(b => b.id === currentCollection.business_id) : null;

    logger.info('User initiated receipt upload from camera', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      collectionId: selectedCollection,
      collectionName: currentCollection?.name,
      businessId: currentBusiness?.id,
      businessName: currentBusiness?.name,
      userId: user.id,
      page: 'ReceiptsPage',
      operation: 'camera_upload_start'
    });

    actionTracker.uploadStarted('receipt', file.name, file.size, { collectionId: selectedCollection });

    setExtracting(true);
    setShowUpload(false);

    const uploadStartTime = Date.now();
    const timestamp = Date.now();
    const fileName = `${user.id}/${timestamp}.webp`;
    const thumbnailName = `${user.id}/thumbnails/${timestamp}_thumb.webp`;

    logger.info('Generated file paths for upload', {
      fileName,
      thumbnailName,
      userId: user.id,
      timestamp,
      businessId: currentBusiness?.id,
      businessName: currentBusiness?.name,
      collectionId: selectedCollection,
      page: 'ReceiptsPage',
      operation: 'generate_file_paths'
    });

    try {
      logger.info('Starting file upload to storage', {
        fileName,
        thumbnailName,
        businessId: currentBusiness?.id,
        businessName: currentBusiness?.name,
        collectionId: selectedCollection,
        page: 'ReceiptsPage',
        operation: 'storage_upload_start'
      });

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

      if (uploadResult.error) {
        logger.error('Main image upload failed', uploadResult.error as Error, {
          fileName,
          errorCode: uploadResult.error.message,
          page: 'ReceiptsPage',
          operation: 'storage_upload_main_image'
        });
        throw uploadResult.error;
      }

      if (thumbnailResult.error) {
        logger.error('Thumbnail upload failed', thumbnailResult.error as Error, {
          thumbnailName,
          errorCode: thumbnailResult.error.message,
          page: 'ReceiptsPage',
          operation: 'storage_upload_thumbnail'
        });
        throw thumbnailResult.error;
      }

      logger.info('Files uploaded successfully to storage', {
        fileName,
        thumbnailName,
        mainImagePath: uploadResult.data?.path,
        thumbnailPath: thumbnailResult.data?.path,
        page: 'ReceiptsPage',
        operation: 'storage_upload_success'
      });

      const { data: { session } } = await supabase.auth.getSession();

      const extractUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-receipt-data`;

      logger.info('Calling extraction edge function', {
        extractUrl,
        fileName,
        collectionId: selectedCollection,
        businessId: currentBusiness?.id,
        businessName: currentBusiness?.name,
        hasSession: !!session,
        page: 'ReceiptsPage',
        operation: 'extraction_api_call_start'
      });

      const response = await fetch(extractUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: fileName,
          collectionId: selectedCollection
        }),
      });

      logger.info('Extraction API response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        fileName,
        page: 'ReceiptsPage',
        operation: 'extraction_api_response'
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Edge function returned error status', new Error(`HTTP ${response.status}`), {
          status: response.status,
          statusText: response.statusText,
          errorText,
          fileName,
          page: 'ReceiptsPage',
          operation: 'extraction_api_error'
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      logger.info('Extraction result parsed', {
        success: result.success,
        hasData: !!result.data,
        vendor: result.data?.vendor_name,
        amount: result.data?.total_amount,
        category: result.data?.category,
        fileName,
        businessId: currentBusiness?.id,
        businessName: currentBusiness?.name,
        collectionId: selectedCollection,
        page: 'ReceiptsPage',
        operation: 'extraction_result_parsed'
      });

      if (!result.success) {
        logger.error('Extraction failed (success=false)', new Error(result.error || 'Extraction failed'), {
          resultError: result.error,
          fileName,
          page: 'ReceiptsPage',
          operation: 'extraction_failed'
        });
        throw new Error(result.error || 'Extraction failed');
      }

      logger.info('Opening verification modal with extracted data', {
        vendor: result.data?.vendor_name,
        amount: result.data?.total_amount,
        category: result.data?.category,
        transactionDate: result.data?.transaction_date,
        fileName,
        businessId: currentBusiness?.id,
        businessName: currentBusiness?.name,
        collectionId: selectedCollection,
        page: 'ReceiptsPage',
        operation: 'show_verification_modal'
      });

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Receipt upload/extraction failed', error as Error, {
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        collectionId: selectedCollection,
        businessId: currentBusiness?.id,
        businessName: currentBusiness?.name,
        fileName,
        thumbnailName,
        page: 'ReceiptsPage',
        operation: 'single_receipt_upload_failed'
      });

      // Clean up uploaded files on error
      logger.info('Attempting to clean up uploaded files', {
        fileName,
        thumbnailName,
        page: 'ReceiptsPage',
        operation: 'cleanup_files_start'
      });

      try {
        await supabase.storage.from('receipts').remove([fileName, thumbnailName]);
        logger.info('Successfully cleaned up files after error', {
          fileName,
          thumbnailName,
          page: 'ReceiptsPage',
          operation: 'cleanup_files_success'
        });
      } catch (cleanupError) {
        logger.error('Failed to clean up files', cleanupError as Error, {
          fileName,
          thumbnailName,
          cleanupErrorMessage: cleanupError instanceof Error ? cleanupError.message : 'Unknown',
          page: 'ReceiptsPage',
          operation: 'cleanup_files_failed'
        });
      }

      alert(`Failed to process receipt: ${errorMessage}\n\nPlease check your internet connection and try again. If the problem persists, the OpenAI API key may not be configured.`);
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
    if (!user) return;

    const receipt = receipts.find(r => r.id === receiptId);
    actionTracker.itemDeleted('receipt', receiptId, {
      vendor: receipt?.vendor_name,
      amount: receipt?.total_amount,
      collectionId: selectedCollection
    });

    try {
      await receiptService.deleteReceipt(receiptId, user.id);
      setReceipts(receipts.filter(r => r.id !== receiptId));
    } catch (error) {
      logger.error('Failed to delete receipt', error as Error, {
        receiptId,
        page: 'ReceiptsPage',
        operation: 'delete_receipt'
      });
      alert('Failed to delete receipt');
    }
  };

  const handleConfirmExtraction = async (filePath: string, thumbnailPath: string, data: any, originalData?: any) => {
    if (!user || !selectedCollection) return;

    try {
      const businessId = await receiptService.getBusinessIdFromCollection(selectedCollection);

      if (verifyReceipt?.isMultiPage && verifyReceipt.multiPageData) {
        const { parentReceiptId, uploadedPaths, pageCount } = verifyReceipt.multiPageData;

        const transactionDateUTC = data.transaction_date
          ? convertLocalDateToUTC(data.transaction_date)
          : null;

        const totalAmount = data.total_amount ? parseFloat(data.total_amount) : 0;
        const subtotal = data.subtotal ? parseFloat(data.subtotal) : null;
        const gstAmount = data.gst_amount ? parseFloat(data.gst_amount) : null;
        const pstAmount = data.pst_amount ? parseFloat(data.pst_amount) : null;

        if (isNaN(totalAmount)) {
          throw new Error('Invalid total amount');
        }

        logger.info('Creating multi-page parent receipt from verification', {
          parentReceiptId,
          totalAmount,
          vendor: data.vendor_name,
          pageCount,
          page: 'ReceiptsPage'
        });

        const { error: parentError } = await supabase
          .from('receipts')
          .insert({
            id: parentReceiptId,
            collection_id: selectedCollection,
            uploaded_by: user.id,
            file_path: null,
            vendor_name: data.vendor_name || null,
            vendor_address: data.vendor_address || null,
            transaction_date: transactionDateUTC,
            total_amount: totalAmount,
            subtotal: subtotal,
            gst_amount: gstAmount,
            pst_amount: pstAmount,
            category: data.category || 'Miscellaneous',
            payment_method: data.payment_method || 'Unknown',
            extraction_status: 'completed',
            is_parent: true,
            total_pages: pageCount,
            page_number: 1,
            extraction_data: {
              transaction_time: data.transaction_time || null,
              gst_percent: data.gst_percent || null,
              pst_percent: data.pst_percent || null,
              card_last_digits: data.card_last_digits || null,
              customer_name: data.customer_name || null,
            },
          });

        if (parentError) throw parentError;

        const childRecords = uploadedPaths.map((paths, index) => ({
          collection_id: selectedCollection,
          uploaded_by: user.id,
          parent_receipt_id: parentReceiptId,
          page_number: index + 1,
          file_path: paths.filePath,
          thumbnail_path: paths.thumbnailPath,
          is_parent: false,
          total_pages: pageCount,
          extraction_status: 'completed',
          total_amount: 0,
        }));

        const { error: childError } = await supabase
          .from('receipts')
          .insert(childRecords);

        if (childError) throw childError;

        logger.info('Multi-page receipt created successfully from verification', {
          parentReceiptId,
          pageCount,
          page: 'ReceiptsPage'
        });

        actionTracker.uploadCompleted('multi-page-receipt', `${pageCount} pages`, 0, {
          collectionId: selectedCollection,
          vendor: data.vendor_name,
          pageCount
        });
      } else {
        await receiptService.createReceipt(selectedCollection, user.id, filePath, thumbnailPath, data);
      }

      if (businessId) {
        const origVendor = originalData?._original_vendor_name || originalData?.vendor_name;
        await receiptService.recordLearning(
          businessId,
          origVendor,
          data.vendor_name,
          data.vendor_name,
          data.category
        );
      }

      setVerifyReceipt(null);
      await reloadReceipts();
    } catch (error) {
      logger.error('Failed to save receipt', error as Error);
      alert('Failed to save receipt');
    }
  };

  const handleCancelExtraction = async (filePath: string) => {
    if (verifyReceipt?.isMultiPage && verifyReceipt.multiPageData) {
      const allPaths = verifyReceipt.multiPageData.uploadedPaths.flatMap(p => [p.filePath, p.thumbnailPath]);
      try {
        await supabase.storage.from('receipts').remove(allPaths);
      } catch (error) {
        logger.error('Failed to clean up multi-page files', error as Error);
      }
    } else {
      await receiptService.deleteStorageFile(filePath);
    }
    setVerifyReceipt(null);
  };

  const handleSearchChangeWithReset = (query: string) => {
    handleSearchChange(query);
    setCurrentPage(1);
  };

  const handleCategoryFilterChangeWithReset = (category: string) => {
    handleCategoryFilterChange(category);
    setCurrentPage(1);
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


  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedReceipts.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedReceipts.size} receipt(s)?`
    );

    if (!confirmed) return;

    const startTime = Date.now();
    const receiptIds = Array.from(selectedReceipts);

    try {
      // Soft delete receipts (triggers will handle audit logs)
      const { error } = await supabase
        .from('receipts')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id
        })
        .in('id', receiptIds);

      if (error) throw error;

      // System logging
      await supabase.from('system_logs').insert({
        level: 'INFO',
        category: 'USER_ACTION',
        message: `Bulk soft deleted ${receiptIds.length} receipts`,
        metadata: {
          user_id: user?.id,
          collection_id: selectedCollection,
          receipt_count: receiptIds.length,
          execution_time_ms: Date.now() - startTime,
          action: 'bulk_soft_delete'
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
      logger.error('Bulk delete failed', error as Error, {
        receiptCount: receiptIds.length,
        page: 'ReceiptsPage',
        operation: 'bulk_delete'
      });
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
      logger.error('Bulk categorize failed', error as Error, {
        receiptCount: receiptIds.length,
        categoryId,
        page: 'ReceiptsPage',
        operation: 'bulk_categorize'
      });
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
      logger.error('Bulk move failed', error as Error, {
        receiptCount: receiptIds.length,
        targetCollectionId,
        page: 'ReceiptsPage',
        operation: 'bulk_move'
      });
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
      logger.error('Bulk CSV export failed', error as Error, {
        receiptCount: receiptIds.length,
        page: 'ReceiptsPage',
        operation: 'bulk_export_csv'
      });
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
        formatDateForDisplay(receipt.transaction_date),
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
      logger.error('Bulk PDF export failed', error as Error, {
        receiptCount: receiptIds.length,
        page: 'ReceiptsPage',
        operation: 'bulk_export_pdf'
      });
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


  if (selectedReceiptId) {
    return (
      <ReceiptDetailsPage
        receiptId={selectedReceiptId}
        onBack={() => setSelectedReceiptId(null)}
      />
    );
  }

  // Show onboarding wizard for new users without businesses or collections
  if (collections.length === 0 && !loading) {
    const hasBusiness = businesses.length > 0;

    // If no business at all, show onboarding wizard
    if (!hasBusiness && !showOnboarding) {
      setShowOnboarding(true);
    }

    return (
      <>
        {showOnboarding && (
          <OnboardingWizard
            onComplete={() => {
              setShowOnboarding(false);
              loadCollections();
            }}
          />
        )}

        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-slate-200 dark:border-gray-700 p-8">
            <div className="mb-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus size={32} className="text-blue-600 dark:text-blue-400" />
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
            {hasBusiness ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('navigate-to-settings', {
                    detail: { section: 'collections' }
                  }));
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <Plus size={20} />
                Create Collection
              </a>
            ) : (
              <button
                onClick={() => setShowOnboarding(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <Plus size={20} />
                Start Setup
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      <ReceiptsHeader
        collections={collections}
        selectedCollection={selectedCollection}
        onCollectionChange={handleCollectionChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChangeWithReset}
        filterCategory={filterCategory}
        onCategoryChange={handleCategoryFilterChangeWithReset}
        advancedFilters={advancedFilters}
        onShowAdvancedFilters={() => setShowAdvancedFilters(true)}
        isSelectMode={isSelectMode}
        onToggleSelectMode={toggleSelectMode}
        onUploadClick={handleUploadClick}
        onManualEntryClick={handleManualEntryClick}
      />

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
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="dark:bg-gray-800">
                    {isSelectMode && (
                      <td className="px-4 py-4">
                        <div className="w-5 h-5 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                          <div className="h-3 w-24 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-20 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 w-20 bg-slate-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-8 h-8 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="w-8 h-8 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="w-8 h-8 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredReceipts.map((receipt) => (
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
                    <div className="flex items-center gap-3">
                      <ReceiptThumbnail
                        thumbnailPath={receipt.thumbnail_path}
                        filePath={receipt.file_path}
                        vendorName={receipt.vendor_name || 'Unknown Vendor'}
                        fileType={receipt.file_path?.split('.').pop()}
                      />
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-white">
                          {receipt.vendor_name || 'Unknown Vendor'}
                          {receipt.source === 'email' && (
                            <Mail size={14} className="text-blue-600 dark:text-blue-400" title="Received via email" />
                          )}
                          {receipt.source === 'camera' && (
                            <Camera size={14} className="text-green-600 dark:text-green-400" title="Captured with camera" />
                          )}
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
                      <span>{formatDateForDisplay(receipt.transaction_date)}</span>
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredReceipts.length === 0 && (
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
            onQuickCaptureComplete?.();
          }}
          autoTriggerPhoto={autoTriggerPhoto}
        />
      )}

      {showMultiPageCamera && !extracting && (
        <MultiPageCameraCapture
          onComplete={handleMultiPageCameraComplete}
          onCancel={() => {
            setShowMultiPageCamera(false);
            onQuickCaptureComplete?.();
          }}
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
        <ManualEntryForm
          onSubmit={handleManualEntry}
          onClose={() => {
            setShowManualEntry(false);
            onQuickCaptureComplete?.();
          }}
        />
      )}

      {verifyReceipt && (
        <VerifyReceiptModal
          receiptId={verifyReceipt.filePath}
          extractedData={verifyReceipt.data}
          onConfirm={(filePath, data, originalData) => handleConfirmExtraction(verifyReceipt.filePath, verifyReceipt.thumbnailPath, data, originalData)}
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
