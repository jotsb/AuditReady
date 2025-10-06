import { Receipt, Calendar, DollarSign, Folder } from 'lucide-react';

interface ReceiptItem {
  id: string;
  vendor_name: string | null;
  transaction_date: string | null;
  total_amount: number;
  category: string | null;
  collections?: {
    name: string;
    businesses?: {
      name: string;
    };
  };
}

interface RecentReceiptsProps {
  receipts: ReceiptItem[];
  onViewReceipt: (id: string) => void;
}

export function RecentReceipts({ receipts, onViewReceipt }: RecentReceiptsProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Recent Receipts</h3>
        <Receipt size={20} className="text-slate-400" />
      </div>

      <div className="space-y-3">
        {receipts.map((receipt) => (
          <button
            key={receipt.id}
            onClick={() => onViewReceipt(receipt.id)}
            className="w-full p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition text-left"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-slate-800 truncate">
                  {receipt.vendor_name || 'Unknown Vendor'}
                </h4>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{formatDate(receipt.transaction_date)}</span>
                    </div>
                    {receipt.category && (
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                        {receipt.category}
                      </span>
                    )}
                  </div>
                  {receipt.collections && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Folder size={12} />
                      <span>
                        {receipt.collections.businesses?.name} - {receipt.collections.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-lg font-semibold text-slate-800">
                <DollarSign size={18} />
                <span>{receipt.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {receipts.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          No receipts yet. Upload your first receipt to get started!
        </div>
      )}
    </div>
  );
}
