import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateForInput, convertLocalDateToUTC, areDatesEqual } from '../../lib/dateUtils';
import { Modal } from '../shared/Modal';
import { ErrorAlert } from '../shared/ErrorAlert';
import { SubmitButton } from '../shared/SubmitButton';
import { logger } from '../../lib/logger';

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
  payment_method: string | null;
  category: string | null;
  notes: string | null;
}

interface EditReceiptModalProps {
  receipt: Receipt;
  onClose: () => void;
  onSave: () => void;
}

interface Category {
  id: string;
  name: string;
}

const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'Check',
  'Other',
];

export function EditReceiptModal({ receipt, onClose, onSave }: EditReceiptModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [formData, setFormData] = useState({
    vendor_name: receipt.vendor_name || '',
    vendor_address: receipt.vendor_address || '',
    transaction_date: formatDateForInput(receipt.transaction_date),
    subtotal: receipt.subtotal?.toString() || '',
    gst_amount: receipt.gst_amount.toString(),
    pst_amount: receipt.pst_amount.toString(),
    total_amount: receipt.total_amount.toString(),
    payment_method: receipt.payment_method || '',
    category: receipt.category || '',
    notes: receipt.notes || '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      logger.error('Error loading categories', err as Error, {
        component: 'EditReceiptModal',
        operation: 'load_categories'
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const subtotal = formData.subtotal ? parseFloat(formData.subtotal) : null;
      const gstAmount = parseFloat(formData.gst_amount) || 0;
      const pstAmount = parseFloat(formData.pst_amount) || 0;
      const totalAmount = parseFloat(formData.total_amount);

      if (isNaN(totalAmount)) {
        throw new Error('Total amount must be a valid number');
      }

      const dateChanged = !areDatesEqual(receipt.transaction_date, formData.transaction_date);
      const transactionDateUTC = dateChanged && formData.transaction_date
        ? convertLocalDateToUTC(formData.transaction_date)
        : receipt.transaction_date;

      const { error: updateError } = await supabase
        .from('receipts')
        .update({
          vendor_name: formData.vendor_name || null,
          vendor_address: formData.vendor_address || null,
          transaction_date: transactionDateUTC,
          subtotal,
          gst_amount: gstAmount,
          pst_amount: pstAmount,
          total_amount: totalAmount,
          payment_method: formData.payment_method || null,
          category: formData.category || null,
          notes: formData.notes || null,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receipt.id);

      if (updateError) throw updateError;

      const { error: auditError } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'update',
        table_name: 'receipts',
        record_id: receipt.id,
        changes: {
          before: {
            vendor_name: receipt.vendor_name,
            transaction_date: receipt.transaction_date,
            total_amount: receipt.total_amount,
            category: receipt.category,
            payment_method: receipt.payment_method,
          },
          after: {
            vendor_name: formData.vendor_name || null,
            transaction_date: formData.transaction_date || null,
            total_amount: totalAmount,
            category: formData.category || null,
            payment_method: formData.payment_method || null,
          },
        },
      });

      if (auditError) {
        logger.error('Audit log error', auditError as Error, {
          receiptId: receipt.id,
          component: 'EditReceiptModal',
          operation: 'create_audit_log'
        });
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Receipt"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition"
            disabled={loading}
          >
            Cancel
          </button>
          <SubmitButton
            loading={loading}
            loadingText="Saving..."
            fullWidth={false}
            onClick={handleSubmit}
          >
            <Save size={20} />
            Save Changes
          </SubmitButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Vendor Name
              </label>
              <input
                type="text"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter vendor name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Vendor Address
              </label>
              <input
                type="text"
                value={formData.vendor_address}
                onChange={(e) => setFormData({ ...formData, vendor_address: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter vendor address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loadingCategories}
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Subtotal
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                GST Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.gst_amount}
                onChange={(e) => setFormData({ ...formData, gst_amount: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                PST Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.pst_amount}
                onChange={(e) => setFormData({ ...formData, pst_amount: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Total Amount *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select payment method</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes"
              />
            </div>
          </div>

        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      </form>
    </Modal>
  );
}
