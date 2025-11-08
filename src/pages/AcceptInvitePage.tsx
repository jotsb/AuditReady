import { useState, useEffect } from 'react';
import { Mail, Building2, Shield, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { checkPasswordStrength, type PasswordStrength } from '../lib/passwordUtils';
import { logger } from '../lib/logger';

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  businessName: string;
  inviterName: string;
  expiresAt: string;
}

const navigate = (path: string) => {
  window.history.pushState({}, '', path);
  window.location.href = path;
};

export default function AcceptInvitePage() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState(false);

  const [showSignupForm, setShowSignupForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('token');

    if (!inviteToken) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    setToken(inviteToken);
    loadInvitation(inviteToken);
  }, []);

  useEffect(() => {
    if (invitation && !user) {
      checkIfUserExists(invitation.email);
    }
  }, [invitation, user]);

  const checkIfUserExists = async (email: string) => {
    try {
      const { data, error } = await supabase.rpc('check_user_exists', { user_email: email });
      if (!error && !data) {
        setShowSignupForm(true);
      }
    } catch (err) {
      logger.error('Error checking user during invitation load', err as Error, {
        hasToken: !!token,
        page: 'AcceptInvitePage',
        operation: 'check_user'
      });
    }
  };

  const loadInvitation = async (inviteToken: string) => {
    logger.info('Loading invitation details', { token: inviteToken.substring(0, 8) + '...' }, 'API');

    try {
      setLoading(true);
      setError('');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`;
      const response = await fetch(`${apiUrl}?token=${inviteToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      const result = await response.json();
      logger.api('/accept-invitation', 'GET', response.status, { result });

      if (!response.ok) {
        logger.error('Failed to load invitation', undefined, { status: response.status, error: result.error });
        throw new Error(result.error || 'Failed to load invitation');
      }

      logger.info('Invitation loaded successfully', { email: result.invitation.email }, 'API');
      setInvitation(result.invitation);
    } catch (err: any) {
      logger.error('Error loading invitation', err, { token: inviteToken.substring(0, 8) + '...' });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!token || !user) return;

    try {
      setProcessing(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to accept this invitation');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'accept_invitation',
          token: token
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation');
      }

      setSuccess('Invitation accepted! Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      logger.error('Error accepting invitation', err as Error, {
        invitationId: invitation?.id,
        page: 'AcceptInvitePage',
        operation: 'accept_invitation'
      });
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invitation) {
      logger.warn('Missing token or invitation during signup', {
        hasToken: !!token,
        hasInvitation: !!invitation,
        page: 'AcceptInvitePage'
      }, 'AUTH');
      setError('Invalid invitation state');
      return;
    }

    logger.info('Starting signup and accept invitation', { email: invitation.email }, 'USER_ACTION');

    if (!fullName || fullName.trim().length === 0) {
      setError('Please enter your full name');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!passwordStrength || passwordStrength.score < 2) {
      logger.warn('Weak password rejected', { score: passwordStrength?.score }, 'SECURITY');
      setError('Please choose a stronger password');
      return;
    }

    if (password !== confirmPassword) {
      logger.warn('Password mismatch', {}, 'USER_ACTION');
      setError('Passwords do not match');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      logger.info('Calling signup_and_accept edge function', { email: invitation.email, apiUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation` }, 'EDGE_FUNCTION');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'signup_and_accept',
          token: token,
          email: invitation.email,
          password: password,
          fullName: fullName
        }),
      });

      const result = await response.json();
      logger.api('/accept-invitation', 'POST', response.status, { action: 'signup_and_accept', result });

      if (!response.ok) {
        logger.error('Edge function error during signup', new Error(result.error || 'Unknown error'), {
          status: response.status,
          error: result.error,
          email: invitation.email,
          page: 'AcceptInvitePage',
          operation: 'signup_and_accept'
        });
        logger.edgeFunction('accept-invitation', false, { error: result.error });
        throw new Error(result.error || 'Failed to create account');
      }

      logger.info('Account created successfully', { email: invitation.email }, 'AUTH');
      logger.edgeFunction('accept-invitation', true, { action: 'signup_and_accept' });

      if (result.session) {
        logger.info('Setting session for new user', {}, 'AUTH');
        try {
          const { error: sessionError } = await supabase.auth.setSession(result.session);
          if (sessionError) {
            logger.error('Session error after signup', sessionError as Error, {
              email: invitation.email,
              page: 'AcceptInvitePage',
              operation: 'set_session'
            });
            throw new Error('Failed to set session: ' + sessionError.message);
          }
          logger.info('Session set successfully', {}, 'AUTH');
        } catch (sessionErr: any) {
          logger.error('Error in setSession', sessionErr as Error, {
            email: invitation.email,
            page: 'AcceptInvitePage',
            operation: 'set_session'
          });
          throw sessionErr;
        }
      } else if (result.requiresLogin) {
        logger.info('Account created, redirecting to login', {}, 'AUTH');
        setSuccess('Account created! Please log in to continue.');
        setTimeout(() => {
          window.location.href = `/auth?email=${encodeURIComponent(invitation.email)}`;
        }, 2000);
        return;
      } else {
        logger.warn('No session returned from signup', {
          email: invitation.email,
          page: 'AcceptInvitePage'
        }, 'AUTH');
      }

      setSuccess('Account created and invitation accepted! Redirecting...');
      logger.info('Redirecting to dashboard', {}, 'NAVIGATION');

      setTimeout(() => {
        logger.debug('Executing redirect to dashboard', {}, 'NAVIGATION');
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err: any) {
      logger.error('Error in handleSignupAndAccept', err as Error, {
        email: invitation?.email,
        page: 'AcceptInvitePage',
        operation: 'signup_and_accept'
      });
      setError(err.message || 'An error occurred during signup');
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (password) {
      try {
        const strength = checkPasswordStrength(password);
        setPasswordStrength(strength);
      } catch (err) {
        logger.error('Error checking password strength', err as Error, {
          page: 'AcceptInvitePage',
          operation: 'check_password_strength'
        });
        setPasswordStrength(null);
      }
    } else {
      setPasswordStrength(null);
    }
  }, [password]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invalid Invitation</h1>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/auth')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Success!</h1>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">{success}</p>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  const isLoggedIn = !!user;
  const emailMatches = user?.email?.toLowerCase() === invitation.email.toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      {processing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-sm">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-center text-gray-700 dark:text-gray-300 font-medium">Creating your account...</p>
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">Please wait, this may take a few seconds.</p>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
            <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Invitation</h1>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Business</span>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{invitation.businessName}</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</span>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{invitation.role}</p>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{invitation.inviterName}</span> invited you to join as a {invitation.role}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Invitation for: <span className="font-medium">{invitation.email}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {isLoggedIn ? (
          emailMatches ? (
            <button
              onClick={handleAcceptInvitation}
              disabled={processing}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  This invitation is for <span className="font-medium">{invitation.email}</span>, but you're logged in as <span className="font-medium">{user.email}</span>.
                </p>
              </div>
              <button
                onClick={() => {
                  supabase.auth.signOut();
                  window.location.reload();
                }}
                className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Log Out and Try Again
              </button>
            </div>
          )
        ) : (
          <>
            {!showSignupForm ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    You already have an account with this email. Please log in to accept the invitation.
                  </p>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.setItem('pendingInviteToken', token || '');
                    window.location.href = '/auth';
                  }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Log In to Accept
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Please create an account to accept this invitation. Your email is already verified.
                  </p>
                </div>
              <form onSubmit={handleSignupAndAccept} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={invitation.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                    placeholder="••••••••"
                    required
                  />
                  {passwordStrength && passwordStrength.score !== undefined && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${passwordStrength.bgColor || 'bg-gray-500'} ${
                              passwordStrength.score === 0 ? 'w-1/4' :
                              passwordStrength.score === 1 ? 'w-1/2' :
                              passwordStrength.score === 2 ? 'w-3/4' :
                              'w-full'
                            }`}
                          />
                        </div>
                        <span className={`text-xs font-medium ${passwordStrength.color || 'text-gray-600'}`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      {passwordStrength.suggestions && passwordStrength.suggestions.length > 0 && (
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-2">
                          {passwordStrength.suggestions.map((suggestion: string, index: number) => (
                            <li key={index}>• {suggestion}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Create Account & Accept Invitation'
                  )}
                </button>
              </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
