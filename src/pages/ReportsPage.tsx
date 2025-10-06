import { useState } from 'react';
import { FileText, Download, ArrowLeft } from 'lucide-react';
import { CSVExportReport } from '../components/reports/CSVExportReport';
import { TaxSummaryReport } from '../components/reports/TaxSummaryReport';
import { YearEndSummaryReport } from '../components/reports/YearEndSummaryReport';
import { PDFExportReport } from '../components/reports/PDFExportReport';

type ReportType = 'csv' | 'tax' | 'yearend' | 'pdf' | null;

export function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>(null);

  if (selectedReport) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition"
        >
          <ArrowLeft size={20} />
          <span>Back to Reports</span>
        </button>

        {selectedReport === 'csv' && <CSVExportReport />}
        {selectedReport === 'tax' && <TaxSummaryReport />}
        {selectedReport === 'yearend' && <YearEndSummaryReport />}
        {selectedReport === 'pdf' && <PDFExportReport />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <FileText size={32} className="text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Reports & Exports</h3>
          <p className="text-slate-600">
            Generate detailed reports for audits and tax purposes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2 md:px-0">
          <button
            onClick={() => setSelectedReport('csv')}
            className="p-6 border-2 border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <Download size={24} className="text-slate-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Export to CSV</h4>
                <p className="text-sm text-slate-600">
                  Download all receipt data in spreadsheet format
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelectedReport('tax')}
            className="p-6 border-2 border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <FileText size={24} className="text-slate-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Tax Summary Report</h4>
                <p className="text-sm text-slate-600">
                  Generate GST/PST summary for tax filing
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelectedReport('yearend')}
            className="p-6 border-2 border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <FileText size={24} className="text-slate-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Year-End Summary</h4>
                <p className="text-sm text-slate-600">
                  Complete annual expense breakdown
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelectedReport('pdf')}
            className="p-6 border-2 border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <Download size={24} className="text-slate-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Export to PDF</h4>
                <p className="text-sm text-slate-600">
                  Create PDF report with receipt images
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
