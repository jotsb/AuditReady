import { useState, useEffect } from 'react';
import { Download, Filter, FileText } from 'lucide-react';
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

export function PDFExportReport() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [selectedBusiness, setSelectedBusiness] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [includeImages, setIncludeImages] = useState(true);

  const [loading, setLoading] = useState(false);

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

  const generatePDF = async () => {
    setLoading(true);

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

      if (error) {
        console.error('Query error:', error);
        throw error;
      }

      let receipts = data || [];
      console.log('Raw receipts from DB:', receipts.length, receipts[0]);

      if (selectedBusiness !== 'all') {
        receipts = receipts.filter((r: any) => r.collections?.business_id === selectedBusiness);
      }

      if (receipts.length === 0) {
        alert('No receipts found matching your filters.');
        return;
      }

      console.log('Filtered receipts:', receipts.length);
      console.log('Sample receipt:', JSON.stringify(receipts[0], null, 2));
      const htmlContent = await generateHTMLReport(receipts, includeImages);
      console.log('HTML content generated, length:', htmlContent.length);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 500);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateHTMLReport = async (receipts: any[], includeImages: boolean) => {
    const totalAmount = receipts.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const totalGST = receipts.reduce((sum, r) => sum + Number(r.gst_amount || 0), 0);
    const totalPST = receipts.reduce((sum, r) => sum + Number(r.pst_amount || 0), 0);

    let imageDataUrls: { index: number; url: string; receipt: any }[] = [];

    if (includeImages) {
      for (let i = 0; i < receipts.length; i++) {
        const receipt = receipts[i];
        if (receipt.file_path) {
          try {
            const { data } = await supabase.storage
              .from('receipts')
              .download(receipt.file_path);

            if (data) {
              const reader = new FileReader();
              const dataUrl = await new Promise<string>((resolve) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(data);
              });
              imageDataUrls.push({ index: i + 1, url: dataUrl, receipt });
            }
          } catch (error) {
            console.error('Error loading image for receipt:', receipt.id, error);
          }
        }
      }
    }

    const filterInfo = [];
    if (selectedBusiness !== 'all') {
      const business = businesses.find(b => b.id === selectedBusiness);
      if (business) filterInfo.push(`Business: ${business.name}`);
    }
    if (selectedCollection !== 'all') {
      const collection = collections.find(c => c.id === selectedCollection);
      if (collection) filterInfo.push(`Collection: ${collection.name}`);
    }
    if (selectedCategory !== 'all') {
      filterInfo.push(`Category: ${selectedCategory}`);
    }
    if (dateFrom) filterInfo.push(`From: ${new Date(dateFrom).toLocaleDateString()}`);
    if (dateTo) filterInfo.push(`To: ${new Date(dateTo).toLocaleDateString()}`);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #333;
          }
          h1 {
            color: #1e40af;
            border-bottom: 3px solid #1e40af;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .summary {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }
          .summary-item {
            text-align: center;
          }
          .summary-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #1e293b;
          }
          .filters {
            background: #e0f2fe;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 11px;
          }
          th {
            background: #1e40af;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 10px;
          }
          td {
            padding: 6px;
            border-bottom: 1px solid #e2e8f0;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .total-row {
            background: #e0f2fe !important;
            font-weight: bold;
          }
          .receipt-image-page {
            page-break-before: always;
            text-align: center;
            padding: 40px 20px;
          }
          .receipt-image-header {
            font-size: 18px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 10px;
          }
          .receipt-image-subheader {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 20px;
          }
          .receipt-image {
            max-width: 100%;
            max-height: 800px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          @media print {
            body {
              padding: 20px;
            }
            .receipt-image-page {
              page-break-before: always;
            }
          }
        </style>
      </head>
      <body>
        <h1>Receipt Report</h1>

        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Receipts</div>
              <div class="summary-value">${receipts.length}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Amount</div>
              <div class="summary-value">$${totalAmount.toFixed(2)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Taxes</div>
              <div class="summary-value">$${(totalGST + totalPST).toFixed(2)}</div>
            </div>
          </div>
        </div>

        ${filterInfo.length > 0 ? `
          <div class="filters">
            <strong>Filters Applied:</strong> ${filterInfo.join(' | ')}
          </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Vendor</th>
              <th>Business</th>
              <th>Category</th>
              <th>Payment</th>
              <th style="text-align: right;">Subtotal</th>
              <th style="text-align: right;">GST</th>
              <th style="text-align: right;">PST</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${receipts.map((r, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${r.transaction_date ? new Date(r.transaction_date).toLocaleDateString() : 'N/A'}</td>
                <td>${r.vendor_name || 'Unknown'}</td>
                <td>${r.collections?.businesses?.name || 'N/A'}</td>
                <td>${r.category || 'Uncategorized'}</td>
                <td>${r.payment_method || 'N/A'}</td>
                <td style="text-align: right;">$${Number(r.subtotal || 0).toFixed(2)}</td>
                <td style="text-align: right;">$${Number(r.gst_amount || 0).toFixed(2)}</td>
                <td style="text-align: right;">$${Number(r.pst_amount || 0).toFixed(2)}</td>
                <td style="text-align: right;">$${Number(r.total_amount || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="6" style="text-align: right; padding-right: 20px;">TOTALS</td>
              <td style="text-align: right;">$${receipts.reduce((sum, r) => sum + Number(r.subtotal || 0), 0).toFixed(2)}</td>
              <td style="text-align: right;">$${totalGST.toFixed(2)}</td>
              <td style="text-align: right;">$${totalPST.toFixed(2)}</td>
              <td style="text-align: right;">$${totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 40px; font-size: 12px; color: #64748b; text-align: center;">
          Report generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
        </div>

        ${imageDataUrls.map(({ index, url, receipt }) => `
          <div class="receipt-image-page">
            <div class="receipt-image-header">Receipt #${index}</div>
            <div class="receipt-image-subheader">
              ${receipt.vendor_name || 'Unknown Vendor'} -
              ${receipt.transaction_date ? new Date(receipt.transaction_date).toLocaleDateString() : 'N/A'} -
              $${Number(receipt.total_amount || 0).toFixed(2)}
            </div>
            <img src="${url}" alt="Receipt #${index}" class="receipt-image" />
          </div>
        `).join('')}
      </body>
      </html>
    `;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Export to PDF</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Generate a professional PDF report with your receipt data and optional images
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-slate-600 dark:text-gray-400" />
            <span className="font-medium text-slate-700 dark:text-gray-300">Filter Options</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Business
              </label>
              <select
                value={selectedBusiness}
                onChange={(e) => setSelectedBusiness(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Businesses</option>
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Collection
              </label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                disabled={selectedBusiness === 'all'}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 dark:bg-gray-700 disabled:cursor-not-allowed"
              >
                <option value="all">All Collections</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => setIncludeImages(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700 dark:text-gray-300">Include receipt images in PDF (if available)</span>
          </label>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 ml-6">
            Note: Including images will significantly increase PDF file size
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={generatePDF}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Download size={20} />
            <span>{loading ? 'Generating...' : 'Generate PDF'}</span>
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">PDF Report Features:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>Professional formatted layout</li>
          <li>Summary statistics at the top</li>
          <li>Detailed transaction table</li>
          <li>Optimized for printing</li>
          <li>Filter information included</li>
        </ul>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-amber-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">How to Save as PDF</h4>
            <p className="text-sm text-amber-800">
              After clicking "Generate PDF", a print dialog will open. Select "Save as PDF" or "Print to PDF"
              from your printer options to save the report as a PDF file on your computer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
