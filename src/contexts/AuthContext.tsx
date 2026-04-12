import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { sessionManager } from '../lib/sessionManager';
import { setUserContext } from '../lib/sentry';

interface Business {
  id: string;
  name: string;
  owner_id: string;
  tax_id?: string;
  currency?: string;
  created_at: string;
  suspended?: boolean;
  suspension_reason?: string;
  soft_deleted?: boolean;
  deletion_reason?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSystemAdmin: boolean;
  businesses: Business[];
  selectedBusiness: Business | null;
  userRole: 'owner' | 'manager' | 'member' | null;
  mfaPending: boolean;
  selectBusiness: (business: Business | null) => void;
  refreshBusinesses: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; requiresMFA?: boolean }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  completeMFA: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SELECTED_BUSINESS_KEY = 'selectedBusinessId';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'member' | null>(null);
  const [mfaPending, setMfaPending] = useState(false);

  const rolesMapRef = { current: {} as Record<string, string> };

  const loadUserContext = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_context', { p_user_id: userId });

      if (error) throw error;

      const ctx = data as { is_admin: boolean; businesses: Business[]; roles: Record<string, string> };

      setIsSystemAdmin(ctx.is_admin);
      rolesMapRef.current = ctx.roles || {};

      const uniqueBusinesses = ctx.businesses || [];
      setBusinesses(uniqueBusinesses);

      const savedBusinessId = localStorage.getItem(SELECTED_BUSINESS_KEY);
      let targetBusiness: Business | null = null;

      if (savedBusinessId && uniqueBusinesses.length > 0) {
        targetBusiness = uniqueBusinesses.find(b => b.id === savedBusinessId) || uniqueBusinesses[0];
      } else if (uniqueBusinesses.length > 0) {
        targetBusiness = uniqueBusinesses[0];
      }

      if (targetBusiness) {
        setSelectedBusiness(targetBusiness);
        localStorage.setItem(SELECTED_BUSINESS_KEY, targetBusiness.id);
        const role = ctx.roles[targetBusiness.id] as 'owner' | 'manager' | 'member' | undefined;
        setUserRole(role || null);
      }
    } catch (error) {
      logger.error('Error loading user context', error as Error, { userId });
    }
  };

  const refreshBusinesses = async () => {
    if (user) {
      await loadUserContext(user.id);
    }
  };

  const selectBusiness = (business: Business | null) => {
    setSelectedBusiness(business);
    if (business) {
      localStorage.setItem(SELECTED_BUSINESS_KEY, business.id);
      const role = rolesMapRef.current[business.id] as 'owner' | 'manager' | 'member' | undefined;
      setUserRole(role || null);
    } else {
      localStorage.removeItem(SELECTED_BUSINESS_KEY);
      setUserRole(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadUserContext(session.user.id);
        setUserContext({
          id: session.user.id,
          email: session.user.email,
        });
      } else {
        setUserContext(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        const mfaPendingEmail = sessionStorage.getItem('mfa_pending_email');
        if (mfaPendingEmail && session?.user) {
          return;
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserContext(session.user.id);
          setUserContext({
            id: session.user.id,
            email: session.user.email,
          });
        } else {
          setIsSystemAdmin(false);
          setUserContext(null);
          setBusinesses([]);
          setSelectedBusiness(null);
          localStorage.removeItem(SELECTED_BUSINESS_KEY);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Check if account is locked before attempting login
    const { data: lockoutStatus } = await supabase.rpc('check_account_lockout', {
      p_email: email
    });

    if (lockoutStatus?.locked) {
      const minutesRemaining = Math.ceil(lockoutStatus.retryAfter / 60);
      const lockoutError = {
        message: `Account temporarily locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
        name: 'AccountLockedError',
        status: 429
      } as AuthError;

      logger.warn('Login attempt on locked account', {
        email,
        lockedUntil: lockoutStatus.lockedUntil,
        attemptsCount: lockoutStatus.attemptsCount
      }, 'AUTH');

      return { error: lockoutError };
    }

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Record failed login attempt
      await supabase.rpc('record_failed_login', {
        p_email: email,
        p_ip_address: null, // IP will be captured server-side
        p_user_agent: navigator.userAgent,
        p_failure_reason: 'invalid_credentials'
      });

      logger.auth('sign_in', false, { email, method: 'password', error: error?.message });
      return { error };
    }

    if (data.user) {
      // First, check user's profile to see if they have MFA enabled
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('suspended, deleted_at, suspension_reason, mfa_enabled')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        logger.auth('sign_in', false, { email, method: 'password', error: 'Failed to check user status' });
        await supabase.auth.signOut();
        return {
          error: {
            message: 'Failed to verify account status',
            name: 'AccountStatusError',
            status: 403
          } as AuthError
        };
      }

      // If user has MFA enabled, check if they have verified factors and require MFA verification
      if (profile?.mfa_enabled) {
        // Check if user has verified MFA factors using database function
        const { data: hasVerifiedMFA, error: mfaError } = await supabase
          .rpc('check_user_mfa_status', { check_user_id: data.user.id });

        if (!mfaError && hasVerifiedMFA) {
          // User has MFA enabled and verified factors - require MFA challenge
          // Store MFA state SYNCHRONOUSLY before any async operations
          sessionStorage.setItem('mfa_pending_email', email);
          sessionStorage.setItem('mfa_user_id', data.user.id);

          setMfaPending(true);
          logger.auth('mfa_challenge_required', true, { email, method: 'password', mfa_enabled: true });
          return { error: null, requiresMFA: true, email };
        }
      }

      // Block suspended users
      if (profile?.suspended) {
        logger.auth('sign_in', false, {
          email,
          method: 'password',
          error: 'Account suspended',
          reason: profile.suspension_reason
        });
        await supabase.auth.signOut();
        return {
          error: {
            message: profile.suspension_reason
              ? `Account suspended: ${profile.suspension_reason}`
              : 'Your account has been suspended. Please contact support.',
            name: 'AccountSuspendedError',
            status: 403
          } as AuthError
        };
      }

      // Block deleted users
      if (profile?.deleted_at) {
        logger.auth('sign_in', false, { email, method: 'password', error: 'Account deleted' });
        await supabase.auth.signOut();
        return {
          error: {
            message: 'This account has been deleted. Please contact support if you believe this is an error.',
            name: 'AccountDeletedError',
            status: 403
          } as AuthError
        };
      }

      // Update last login timestamp
      const { error: loginUpdateError } = await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.user.id);

      if (loginUpdateError) {
        logger.error('Failed to update last_login_at', loginUpdateError, { userId: data.user.id });
      }

      sessionManager.setUserId(data.user.id);
      logger.auth('sign_in', true, { email, method: 'password' });
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data.user) {
      sessionManager.setUserId(data.user.id);
      logger.auth('sign_up', true, { email, fullName });
      // The trigger automatically creates the profile with full_name from metadata
    } else {
      logger.auth('sign_up', false, { email, error: error?.message });
    }

    return { error };
  };

  const signOut = async () => {
    logger.auth('sign_out', true, { userId: user?.id });
    await supabase.auth.signOut();
    sessionManager.clearSession();
    setBusinesses([]);
    setSelectedBusiness(null);
    setMfaPending(false);
    sessionStorage.removeItem('mfa_pending_email');
    localStorage.removeItem(SELECTED_BUSINESS_KEY);
  };

  const completeMFA = async () => {
    setMfaPending(false);
    sessionStorage.removeItem('mfa_pending_email');

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      await loadUserContext(session.user.id);
      logger.auth('mfa_verification_complete', true, { userId: session.user.id });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSystemAdmin,
        businesses,
        selectedBusiness,
        userRole,
        mfaPending,
        selectBusiness,
        refreshBusinesses,
        signIn,
        signUp,
        signOut,
        completeMFA
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
