import { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess(true);
      logger.auth('password_reset_requested', true, { email });
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
      logger.auth('password_reset_requested', false, { email, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Mail size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Check Your Email</h1>
          <p className="text-slate-600 dark:text-gray-400">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
        </div>

        <div className="space-y-4 text-sm text-slate-600 dark:text-gray-400">
          <p>Click the link in the email to reset your password.</p>
          <p>If you don't see the email, check your spam folder.</p>
        </div>

        <button
          onClick={onBack}
          className="w-full mt-6 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
        >
          <ArrowLeft size={20} />
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Reset Password</h1>
        <p className="text-slate-600 dark:text-gray-400">Enter your email to receive a reset link</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="you@example.com"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span>Sending...</span>
          ) : (
            <>
              <Mail size={20} />
              <span>Send Reset Link</span>
            </>
          )}
        </button>
      </form>

      <button
        onClick={onBack}
        className="w-full mt-4 text-slate-600 hover:text-slate-800 font-medium py-2 flex items-center justify-center gap-2"
      >
        <ArrowLeft size={18} />
        Back to Login
      </button>
    </div>
  );
}
