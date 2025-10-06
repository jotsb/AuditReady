import { useState, useEffect } from 'react';
import { Download, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Business {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
  business_id: string;
}

interface ReceiptData {
  id: string;
  vendor_name: string | null;
  transaction_date: string | null;
  subtotal: number;
  gst_amount: number;
  pst_amount: number;
  total_amount: number;
  payment_method: string | null;
  category: string | null;
  collections: {
    name: string;
    businesses: {
      name: string;
    };
  };
}

export function CSVExportReport() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [selectedBusiness, setSelectedBusiness] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loading, setLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (selectedBusiness !== 'all') {
      loadCollectionsForBusiness(selectedBusiness);
    } else {
      setCollections([]);
      setSelectedCollection('all');
    }
  }, [selectedBusiness]);

  const loadFilters = async () => {
    try {
      const [businessData, categoryData] = await Promise.all([
        supabase.from('businesses').select('*').order('name'),
        supabase.from('expense_categories').select('name').order('name')
      ]);

      setBusinesses(businessData.data || []);
      setCategories(categoryData.data?.map(c => c.name) || []);
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  const loadCollectionsForBusiness = async (businessId: string) => {
    try {
      const { data } = await supabase
        .from('collections')
        .select('*')
        .eq('business_id', businessId)
        .order('name');

      setCollections(data || []);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const exportToCSV = async () => {
    setLoading(true);
    setExportSuccess(false);

    try {
      let query = supabase
        .from('receipts')
        .select('*, collections!inner(id, name, business_id, businesses(name))');

      if (selectedCollection !== 'all') {
        query = query.eq('collection_id', selectedCollection);
      }

      if (dateFrom) {
        query = query.gte('transaction_date', dateFrom);
      }

      if (dateTo) {
        query = query.lte('transaction_date', dateTo);
      }

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query.order('transaction_date', { ascending: false });

      if (error) throw error;

      let receipts = (data || []) as unknown as ReceiptData[];

      if (selectedBusiness !== 'all') {
        receipts = receipts.filter((r: any) => r.collections?.business_id === selectedBusiness);
      }

      if (receipts.length === 0) {
        alert('No receipts found matching your filters.');
        return;
      }

      const headers = [
        'Date',
        'Vendor',
        'Business',
        'Collection',
        'Category',
        'Payment Method',
        'Subtotal',
        'GST',
        'PST',
        'Total'
      ];

      const rows = receipts.map(r => [
        r.transaction_date ? new Date(r.transaction_date).toLocaleDateString() : '',
        r.vendor_name || '',
        r.collections?.businesses?.name || '',
        r.collections?.name || '',
        r.category || '',
        r.payment_method || '',
        r.subtotal?.toFixed(2) || '0.00',
        r.gst_amount?.toFixed(2) || '0.00',
        r.pst_amount?.toFixed(2) || '0.00',
        r.total_amount?.toFixed(2) || '0.00'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipts-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Export to CSV</h3>
          <p className="text-sm text-slate-600">
            Download your receipt data in spreadsheet format for easy analysis in Excel or Google Sheets
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-slate-600" />
            <span className="font-medium text-slate-700">Filter Options</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2 md:px-0">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Business
              </label>
              <select
                value={selectedBusiness}
                onChange={(e) => setSelectedBusiness(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Businesses</option>
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Collection
              </label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                disabled={selectedBusiness === 'all'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="all">All Collections</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={exportToCSV}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={20} />
            <span>{loading ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          {exportSuccess && (
            <span className="text-green-600 font-medium">
              CSV exported successfully!
            </span>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">CSV Export Includes:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>Transaction date</li>
          <li>Vendor name</li>
          <li>Business and collection details</li>
          <li>Category and payment method</li>
          <li>Subtotal, GST, PST, and total amounts</li>
        </ul>
      </div>
    </div>
  );
}
