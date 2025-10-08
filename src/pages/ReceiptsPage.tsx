import { useEffect, useState } from 'react';
import { Plus, Upload, CreditCard as Edit, Search, Filter, Calendar, DollarSign, Trash2, Loader2, Eye, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ReceiptUpload } from '../components/receipts/ReceiptUpload';
import { ManualEntryForm } from '../components/receipts/ManualEntryForm';
import { VerifyReceiptModal } from '../components/receipts/VerifyReceiptModal';
import { EditReceiptModal } from '../components/receipts/EditReceiptModal';
import { ReceiptDetailsPage } from './ReceiptDetailsPage';
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
        .eq('extraction_status', 'completed');

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('collection_id', selectedCollection)
        .eq('extraction_status', 'completed')
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredReceipts = receipts.filter((receipt) => {
    const matchesSearch =
      !searchQuery ||
      receipt.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || receipt.category === filterCategory;
    return matchesSearch && matchesCategory;
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
    <div className="space-y-6">
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
              className="w-full md:w-auto pl-10 pr-8 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              <option value="Meals & Entertainment">Meals & Entertainment</option>
              <option value="Transportation">Transportation</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-gray-800 border-b border-slate-200">
              <tr>
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
                  className="hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition cursor-pointer"
                  onClick={() => handleViewClick(receipt.id)}
                >
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <div className="text-sm text-slate-600 dark:text-gray-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} receipts
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                              : 'text-slate-700 dark:text-gray-300 bg-white border border-slate-300 dark:border-gray-600 hover:bg-slate-50'
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
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showUpload && !extracting && (
        <ReceiptUpload
          onUpload={handleUpload}
          onClose={() => {
            setShowUpload(false);
            setAutoTriggerPhoto(false);
          }}
          autoTriggerPhoto={autoTriggerPhoto}
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
    </div>
  );
}
