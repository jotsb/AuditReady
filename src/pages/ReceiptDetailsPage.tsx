import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, DollarSign, MapPin, CreditCard, Tag, FileText, Clock, Download, User, Percent, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EditReceiptModal } from '../components/receipts/EditReceiptModal';
import type { Database } from '../lib/database.types';

type Receipt = Database['public']['Tables']['receipts']['Row'];

interface ReceiptDetailsPageProps {
  receiptId: string;
  onBack: () => void;
}

export function ReceiptDetailsPage({ receiptId, onBack }: ReceiptDetailsPageProps) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    loadReceipt();
  }, [receiptId]);

  const loadReceipt = async () => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setReceipt(data);

        if (data.file_path) {
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from('receipts')
            .createSignedUrl(data.file_path, 3600);

          if (!urlError && signedUrlData) {
            setImageUrl(signedUrlData.signedUrl);
          }
        }
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!receipt?.file_path) return;

    try {
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
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Failed to download receipt');
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
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6"
        >
          <ArrowLeft size={20} />
          <span>Back to Receipts</span>
        </button>
        <div className="text-center text-slate-600">Receipt not found</div>
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 md:p-0 md:mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition"
        >
          <ArrowLeft size={20} />
          <span>Back to Receipts</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">Receipt Details</h2>
                {receipt.is_edited && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                    Edited
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditingReceipt(receipt)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                <Edit2 size={16} />
                <span>Edit</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-600">Vendor</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {receipt.vendor_name || 'Unknown'}
                  </div>
                </div>
              </div>

              {receipt.vendor_address && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <MapPin size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-600">Address</div>
                    <div className="text-slate-800">{receipt.vendor_address}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Calendar size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-600">Date</div>
                    <div className="text-slate-800">
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
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Clock size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-600">Time</div>
                      <div className="text-slate-800">{receipt.extraction_data.transaction_time}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <DollarSign size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-600">Total Amount</div>
                    <div className="text-2xl font-bold text-slate-800">
                      ${receipt.total_amount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="ml-11 space-y-2 text-sm">
                  {receipt.subtotal && parseFloat(receipt.subtotal.toString()) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="text-slate-800">${parseFloat(receipt.subtotal.toString()).toFixed(2)}</span>
                    </div>
                  )}
                  {receipt.gst_amount && parseFloat(receipt.gst_amount.toString()) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        GST {receipt.extraction_data?.gst_percent && `(${receipt.extraction_data.gst_percent}%)`}
                      </span>
                      <span className="text-slate-800">${parseFloat(receipt.gst_amount.toString()).toFixed(2)}</span>
                    </div>
                  )}
                  {receipt.pst_amount && parseFloat(receipt.pst_amount.toString()) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        PST {receipt.extraction_data?.pst_percent && `(${receipt.extraction_data.pst_percent}%)`}
                      </span>
                      <span className="text-slate-800">${parseFloat(receipt.pst_amount.toString()).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Tag size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-600">Category</div>
                  <div className="text-slate-800">{receipt.category}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CreditCard size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-600">Payment Method</div>
                  <div className="text-slate-800">
                    {receipt.payment_method}
                    {receipt.extraction_data?.card_last_digits && (
                      <span className="text-slate-500 ml-2">(...{receipt.extraction_data.card_last_digits})</span>
                    )}
                  </div>
                </div>
              </div>

              {receipt.extraction_data?.customer_name && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <User size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-600">Customer Name</div>
                    <div className="text-slate-800">{receipt.extraction_data.customer_name}</div>
                  </div>
                </div>
              )}

              {receipt.notes && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600 mb-2">Notes</div>
                  <div className="text-slate-800 bg-slate-50 p-3 rounded-lg">
                    {receipt.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Metadata</h3>
            <div className="space-y-2 text-sm">
              {receipt.extraction_status && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Extraction Status</span>
                  <span className={`font-medium ${
                    receipt.extraction_status === 'completed' ? 'text-green-600' :
                    receipt.extraction_status === 'processing' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {receipt.extraction_status.charAt(0).toUpperCase() + receipt.extraction_status.slice(1)}
                  </span>
                </div>
              )}
              {receipt.is_edited && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Modified</span>
                  <span className="text-blue-600 font-medium">Yes</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Created</span>
                <span className="text-slate-800">
                  {new Date(receipt.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Updated</span>
                <span className="text-slate-800">
                  {new Date(receipt.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Original Receipt</h3>
            {imageUrl && receipt?.file_path && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Download size={16} />
                <span>Download</span>
              </button>
            )}
          </div>
          {imageUrl ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt="Receipt"
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-center text-slate-500">
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
