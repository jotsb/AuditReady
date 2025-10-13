import { useState } from 'react';
import { Copy, Download, Printer, Check, AlertTriangle } from 'lucide-react';
import { downloadRecoveryCodes, copyToClipboard } from '../../lib/mfaUtils';

interface RecoveryCodesDisplayProps {
  codes: string[];
  onConfirm: () => void;
  onCancel?: () => void;
}

export function RecoveryCodesDisplay({ codes, onConfirm, onCancel }: RecoveryCodesDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = async () => {
    const text = codes.map((code, i) => `${i + 1}. ${code}`).join('\n');
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadRecoveryCodes(codes);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Audit Proof - Recovery Codes</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
            }
            h1 {
              color: #1f2937;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 10px;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
            }
            .codes {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .code-item {
              padding: 8px;
              border-bottom: 1px solid #e5e7eb;
              font-family: monospace;
              font-size: 14px;
            }
            .code-item:last-child {
              border-bottom: none;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>Audit Proof - Recovery Codes</h1>
          <div class="warning">
            <strong>IMPORTANT:</strong> Keep these codes safe and secure!
            <ul>
              <li>Each code can only be used once</li>
              <li>Use these if you lose access to your authenticator app</li>
              <li>Generate new codes if you use all of them</li>
            </ul>
          </div>
          <div class="codes">
            <h3>Your Recovery Codes:</h3>
            ${codes.map((code, i) => `
              <div class="code-item">
                <strong>${(i + 1).toString().padStart(2, '0')}.</strong> ${code}
              </div>
            `).join('')}
          </div>
          <div class="footer">
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Expires:</strong> 1 year from generation date</p>
            <p>Store these codes in a safe place such as a password manager, secure note, or printed copy in a safe location.</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleConfirm = () => {
    if (confirmed) {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-yellow-600" />
          <h2 className="text-2xl font-bold">Save Your Recovery Codes</h2>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
            IMPORTANT: You won't be able to see these codes again!
          </p>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>• Each code can only be used once</li>
            <li>• Use these if you lose access to your authenticator app</li>
            <li>• Store them in a secure location like a password manager</li>
            <li>• Generate new codes if you use all of them</li>
          </ul>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy All
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Your Recovery Codes:</h3>
          <div className="grid grid-cols-2 gap-3">
            {codes.map((code, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                  {(index + 1).toString().padStart(2, '0')}.
                </span>
                <span className="font-mono text-base font-semibold text-gray-900 dark:text-white">
                  {code}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Recommended storage locations:</strong>
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
            <li>• Password manager (1Password, Bitwarden, LastPass)</li>
            <li>• Secure note on your device</li>
            <li>• Printed copy in a safe or locked drawer</li>
          </ul>
        </div>

        <label className="flex items-center gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I have saved these codes in a safe place
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={!confirmed}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Continue
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
