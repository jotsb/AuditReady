import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, DollarSign, MapPin, CreditCard, Tag, FileText, Clock, Download, User, Percent, CreditCard as Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EditReceiptModal } from '../components/receipts/EditReceiptModal';
import { PageThumbnailStrip } from '../components/receipts/PageThumbnailStrip';
import type { Database } from '../lib/database.types';
import { logger } from '../lib/logger';

type Receipt = Database['public']['Tables']['receipts']['Row'];

interface ReceiptDetailsPageProps {
  receiptId: string;
  onBack: () => void;
}

interface ReceiptPage {
  id: string;
  page_number: number;
  file_path: string;
  thumbnail_path: string;
  created_at: string;
  thumbnailSignedUrl?: string | null;
}

export function ReceiptDetailsPage({ receiptId, onBack }: ReceiptDetailsPageProps) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<ReceiptPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    loadReceipt();
  }, [receiptId]);

  const loadReceipt = async () => {
    const startTime = performance.now();
    try {
      logger.info('Loading receipt details', { receiptId, page: 'ReceiptDetailsPage' }, 'DATABASE');

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setReceipt(data);

        if (data.is_parent) {
          const { data: pagesData, error: pagesError } = await supabase.rpc(
            'get_receipt_pages',
            { receipt_uuid: receiptId }
          );

          if (!pagesError && pagesData) {
            // Generate signed URLs for thumbnails
            const pagesWithSignedThumbnails = await Promise.all(
              pagesData.map(async (page: ReceiptPage) => {
                if (page.thumbnail_path) {
                  const { data: thumbData, error: thumbError } = await supabase.storage
                    .from('receipts')
                    .createSignedUrl(page.thumbnail_path, 3600);

                  return {
                    ...page,
                    thumbnailSignedUrl: thumbError ? null : thumbData?.signedUrl
                  };
                }
                return page;
              })
            );

            setPages(pagesWithSignedThumbnails as ReceiptPage[]);

            if (pagesData.length > 0) {
              const firstPagePath = pagesData[0].file_path;
              const { data: signedUrlData, error: urlError } = await supabase.storage
                .from('receipts')
                .createSignedUrl(firstPagePath, 3600);

              if (!urlError && signedUrlData) {
                setImageUrl(signedUrlData.signedUrl);
              }
            }
          }
        } else {
          if (data.file_path) {
            const { data: signedUrlData, error: urlError } = await supabase.storage
              .from('receipts')
              .createSignedUrl(data.file_path, 3600);

            if (!urlError && signedUrlData) {
              setImageUrl(signedUrlData.signedUrl);
            } else if (urlError) {
              logger.warn('Failed to generate signed URL', { receiptId, error: urlError.message, page: 'ReceiptDetailsPage' }, 'DATABASE');
            }
          }
        }

        const loadTime = performance.now() - startTime;
        logger.performance('Receipt details loaded', loadTime, {
          receiptId,
          page: 'ReceiptDetailsPage',
          hasImage: !!data.file_path,
          isMultiPage: data.is_parent,
          totalPages: data.total_pages
        });
      } else {
        logger.warn('Receipt not found', { receiptId, page: 'ReceiptDetailsPage' }, 'DATABASE');
      }
    } catch (error) {
      logger.error('Error loading receipt', error as Error, {
        receiptId,
        page: 'ReceiptDetailsPage',
        operation: 'load_receipt'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async (pageIndex: number) => {
    setCurrentPageIndex(pageIndex);
    const page = pages[pageIndex];
    if (page?.file_path) {
      const { data: signedUrlData, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(page.file_path, 3600);

      if (!error && signedUrlData) {
        setImageUrl(signedUrlData.signedUrl);
      }
    }
  };

  const handleDownload = async () => {
    if (pages.length > 0) {
      const currentPage = pages[currentPageIndex];
      if (!currentPage?.file_path) return;

      try {
        logger.info('Downloading receipt page', {
          receiptId: receipt?.id,
          pageNumber: currentPage.page_number,
          vendor: receipt?.vendor_name,
          page: 'ReceiptDetailsPage'
        }, 'USER_ACTION');

        const { data, error } = await supabase.storage
          .from('receipts')
          .download(currentPage.file_path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${receipt?.vendor_name || 'unknown'}-page-${currentPage.page_number}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info('Receipt page downloaded successfully', {
          receiptId: receipt?.id,
          pageNumber: currentPage.page_number,
          page: 'ReceiptDetailsPage'
        }, 'USER_ACTION');
      } catch (error) {
        logger.error('Failed to download receipt page', error as Error, {
          receiptId: receipt?.id,
          filePath: currentPage.file_path,
          page: 'ReceiptDetailsPage'
        });
        alert('Failed to download receipt page');
      }
    } else if (receipt?.file_path) {
      try {
        logger.info('Downloading receipt', {
          receiptId: receipt.id,
          vendor: receipt.vendor_name,
          page: 'ReceiptDetailsPage'
        }, 'USER_ACTION');

        const { data, error } = await supabase.storage
          .from('receipts')
          .download(receipt.file_path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${receipt.vendor_name || 'unknown'}-${receipt.transaction_date}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info('Receipt downloaded successfully', {
          receiptId: receipt.id,
          page: 'ReceiptDetailsPage'
        }, 'USER_ACTION');
      } catch (error) {
        logger.error('Failed to download receipt', error as Error, {
          receiptId: receipt?.id,
          filePath: receipt?.file_path,
          page: 'ReceiptDetailsPage'
        });
        alert('Failed to download receipt');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:text-white mb-6"
        >
          <ArrowLeft size={20} />
          <span>Back to Receipts</span>
        </button>
        <div className="text-center text-slate-600 dark:text-gray-400">Receipt not found</div>
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 md:p-0 md:mb-6 mt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:text-white transition"
        >
          <ArrowLeft size={20} />
          <span>Back to Receipts</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Receipt Details</h2>
                {receipt.is_edited && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                    Edited
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditingReceipt(receipt)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 dark:bg-gray-700 transition"
              >
                <Edit2 size={16} />
                <span>Edit</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <FileText size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-600 dark:text-gray-400">Vendor</div>
                  <div className="text-lg font-semibold text-slate-800 dark:text-white">
                    {receipt.vendor_name || 'Unknown'}
                  </div>
                </div>
              </div>

              {receipt.vendor_address && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <MapPin size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-600 dark:text-gray-400">Address</div>
                    <div className="text-slate-800 dark:text-white">{receipt.vendor_address}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-600 dark:text-gray-400">Date</div>
                    <div className="text-slate-800 dark:text-white">
                      {new Date(receipt.transaction_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>

                {receipt.extraction_data?.transaction_time && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <Clock size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-600 dark:text-gray-400">Time</div>
                      <div className="text-slate-800 dark:text-white">{receipt.extraction_data.transaction_time}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <DollarSign size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-600 dark:text-gray-400">Total Amount</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                      ${receipt.total_amount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="ml-11 space-y-2 text-sm">
                  {receipt.subtotal && parseFloat(receipt.subtotal.toString()) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-gray-400">Subtotal</span>
                      <span className="text-slate-800 dark:text-white">${parseFloat(receipt.subtotal.toString()).toFixed(2)}</span>
                    </div>
                  )}
                  {receipt.gst_amount && parseFloat(receipt.gst_amount.toString()) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-gray-400">
                        GST {receipt.extraction_data?.gst_percent && `(${receipt.extraction_data.gst_percent}%)`}
                      </span>
                      <span className="text-slate-800 dark:text-white">${parseFloat(receipt.gst_amount.toString()).toFixed(2)}</span>
                    </div>
                  )}
                  {receipt.pst_amount && parseFloat(receipt.pst_amount.toString()) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-gray-400">
                        PST {receipt.extraction_data?.pst_percent && `(${receipt.extraction_data.pst_percent}%)`}
                      </span>
                      <span className="text-slate-800 dark:text-white">${parseFloat(receipt.pst_amount.toString()).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <Tag size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-600 dark:text-gray-400">Category</div>
                  <div className="text-slate-800 dark:text-white">{receipt.category}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <CreditCard size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-600 dark:text-gray-400">Payment Method</div>
                  <div className="text-slate-800 dark:text-white">
                    {receipt.payment_method}
                    {receipt.extraction_data?.card_last_digits && (
                      <span className="text-slate-500 dark:text-gray-400 ml-2">(...{receipt.extraction_data.card_last_digits})</span>
                    )}
                  </div>
                </div>
              </div>

              {receipt.extraction_data?.customer_name && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <User size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-600 dark:text-gray-400">Customer Name</div>
                    <div className="text-slate-800 dark:text-white">{receipt.extraction_data.customer_name}</div>
                  </div>
                </div>
              )}

              {receipt.notes && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600 dark:text-gray-400 mb-2">Notes</div>
                  <div className="text-slate-800 dark:text-white bg-slate-50 dark:bg-gray-800 p-3 rounded-lg">
                    {receipt.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Metadata</h3>
            <div className="space-y-2 text-sm">
              {receipt.extraction_status && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-gray-400">Extraction Status</span>
                  <span className={`font-medium ${
                    receipt.extraction_status === 'completed' ? 'text-green-600 dark:text-green-400' :
                    receipt.extraction_status === 'processing' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {receipt.extraction_status.charAt(0).toUpperCase() + receipt.extraction_status.slice(1)}
                  </span>
                </div>
              )}
              {receipt.is_edited && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-gray-400">Modified</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Yes</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-gray-400">Created</span>
                <span className="text-slate-800 dark:text-white">
                  {new Date(receipt.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-gray-400">Updated</span>
                <span className="text-slate-800 dark:text-white">
                  {new Date(receipt.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                Original Receipt
                {pages.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-600 dark:text-gray-400">
                    ({pages.length} {pages.length === 1 ? 'page' : 'pages'})
                  </span>
                )}
              </h3>
            </div>
            {imageUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Download size={16} />
                <span>Download{pages.length > 0 ? ` Page ${currentPageIndex + 1}` : ''}</span>
              </button>
            )}
          </div>

          {pages.length > 0 ? (
            <div className="space-y-4">
              <div className="border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <img
                  src={imageUrl || ''}
                  alt={`Receipt Page ${currentPageIndex + 1}`}
                  className="w-full h-auto"
                />
              </div>

              {pages.length > 1 && (
                <>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handlePageChange(Math.max(0, currentPageIndex - 1))}
                      disabled={currentPageIndex === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={20} />
                      <span>Previous</span>
                    </button>

                    <div className="text-sm text-slate-600 dark:text-gray-400 font-medium">
                      Page {currentPageIndex + 1} of {pages.length}
                    </div>

                    <button
                      onClick={() => handlePageChange(Math.min(pages.length - 1, currentPageIndex + 1))}
                      disabled={currentPageIndex === pages.length - 1}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Next</span>
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  <PageThumbnailStrip
                    pages={pages.map((p) => ({
                      id: p.id,
                      preview: p.thumbnailSignedUrl || '',
                      pageNumber: p.page_number,
                    }))}
                    currentPage={currentPageIndex + 1}
                    onPageClick={(pageNum) => handlePageChange(pageNum - 1)}
                  />
                </>
              )}
            </div>
          ) : imageUrl ? (
            <div className="border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt="Receipt"
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-slate-50 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="text-center text-slate-500 dark:text-gray-400">
                <FileText size={48} className="mx-auto mb-2 opacity-50" />
                <p>No image available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSave={() => {
            setEditingReceipt(null);
            loadReceipt();
          }}
        />
      )}
    </div>
  );
}
