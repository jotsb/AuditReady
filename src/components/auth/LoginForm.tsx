import { useState } from 'react';
import { LogIn, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';

interface LoginFormProps {
  onToggleMode: () => void;
  onForgotPassword: () => void;
}

export function LoginForm({ onToggleMode, onForgotPassword }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUnverifiedMessage, setShowUnverifiedMessage] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { signIn } = useAuth();

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setResendSuccess(false);
    setError('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setResendSuccess(true);
      logger.auth('verification_email_resent', true, { email });
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email');
      logger.auth('verification_email_resent', false, { email, error: err.message });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowUnverifiedMessage(false);
    setResendSuccess(false);
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
        setShowUnverifiedMessage(true);
        logger.auth('login_failed', false, { email, reason: 'email_not_verified' });
      } else {
        setError(error.message);
        logger.auth('login_failed', false, { email, error: error.message });
      }
    } else {
      logger.auth('login_success', true, { email });
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
        <p className="text-slate-600">Sign in to your AuditReady account</p>
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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Enter your password"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {showUnverifiedMessage && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <Mail size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 mb-1">
                  Email Not Verified
                </p>
                <p className="text-sm text-amber-700">
                  Please verify your email address before signing in. Check your inbox for the verification link we sent to <strong>{email}</strong>.
                </p>
              </div>
            </div>

            {resendSuccess && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                Verification email sent! Check your inbox.
              </div>
            )}

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendingEmail}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <LogIn size={20} />
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center space-y-3">
        <button
          onClick={onForgotPassword}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          Forgot your password?
        </button>
        <p className="text-slate-600">
          Don't have an account?{' '}
          <button
            onClick={onToggleMode}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create Account
          </button>
        </p>
      </div>
    </div>
  );
}
