import { useState } from 'react';
import { Receipt } from 'lucide-react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-12 items-center">
        <div className="hidden md:block">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 dark:bg-blue-500 rounded-2xl mb-6">
              <Receipt size={40} className="text-white" />
            </div>
            <h2 className="text-4xl font-bold text-slate-800 dark:text-white mb-4">AuditReady</h2>
            <p className="text-xl text-slate-600 dark:text-gray-300 mb-8">
              Digital Receipt Management for Small Businesses
            </p>
          </div>

          <div className="space-y-6 text-slate-700 dark:text-gray-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1 dark:text-white">Capture Receipts</h3>
                <p className="text-slate-600 dark:text-gray-400">Snap photos or upload images and PDFs instantly</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1 dark:text-white">Auto-Extract Data</h3>
                <p className="text-slate-600 dark:text-gray-400">AI extracts vendor, date, amounts, and taxes automatically</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1 dark:text-white">Generate Reports</h3>
                <p className="text-slate-600 dark:text-gray-400">Export to CSV/PDF for audits and tax season</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          {mode === 'login' && (
            <LoginForm
              onToggleMode={() => setMode('register')}
              onForgotPassword={() => setMode('forgot')}
            />
          )}
          {mode === 'register' && (
            <RegisterForm onToggleMode={() => setMode('login')} />
          )}
          {mode === 'forgot' && (
            <ForgotPasswordForm onBack={() => setMode('login')} />
          )}
        </div>
      </div>
    </div>
  );
}
