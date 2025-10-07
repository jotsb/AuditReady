import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { sessionManager } from '../lib/sessionManager';

interface Business {
  id: string;
  name: string;
  owner_id: string;
  tax_id?: string;
  currency?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSystemAdmin: boolean;
  businesses: Business[];
  selectedBusiness: Business | null;
  selectBusiness: (business: Business | null) => void;
  refreshBusinesses: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SELECTED_BUSINESS_KEY = 'selectedBusinessId';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('system_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    setIsSystemAdmin(!!data);
  };

  const loadBusinesses = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBusinesses(data || []);

      // Restore selected business from localStorage
      const savedBusinessId = localStorage.getItem(SELECTED_BUSINESS_KEY);
      if (savedBusinessId && data) {
        const savedBusiness = data.find(b => b.id === savedBusinessId);
        if (savedBusiness) {
          setSelectedBusiness(savedBusiness);
        } else if (data.length > 0) {
          // If saved business not found, select first one
          setSelectedBusiness(data[0]);
          localStorage.setItem(SELECTED_BUSINESS_KEY, data[0].id);
        }
      } else if (data && data.length > 0) {
        // No saved selection, select first business
        setSelectedBusiness(data[0]);
        localStorage.setItem(SELECTED_BUSINESS_KEY, data[0].id);
      }
    } catch (error) {
      console.error('Error loading businesses:', error);
    }
  };

  const refreshBusinesses = async () => {
    if (user) {
      await loadBusinesses(user.id);
    }
  };

  const selectBusiness = (business: Business | null) => {
    setSelectedBusiness(business);
    if (business) {
      localStorage.setItem(SELECTED_BUSINESS_KEY, business.id);
    } else {
      localStorage.removeItem(SELECTED_BUSINESS_KEY);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
        loadBusinesses(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkAdminStatus(session.user.id);
          await loadBusinesses(session.user.id);
        } else {
          setIsSystemAdmin(false);
          setBusinesses([]);
          setSelectedBusiness(null);
          localStorage.removeItem(SELECTED_BUSINESS_KEY);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      // Check if user is suspended or deleted
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('suspended, deleted_at, suspension_reason')
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
        console.error('Failed to update last_login_at:', loginUpdateError);
      }

      sessionManager.setUserId(data.user.id);
      logger.auth('sign_in', true, { email, method: 'password' });
    } else {
      logger.auth('sign_in', false, { email, method: 'password', error: error?.message });
    }

    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (!error && data.user) {
      sessionManager.setUserId(data.user.id);
      logger.auth('sign_up', true, { email, fullName });

      await new Promise(resolve => setTimeout(resolve, 500));

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', data.user.id);

      if (profileError) {
        logger.auth('profile_update', false, { email, error: profileError.message });
      }
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
    localStorage.removeItem(SELECTED_BUSINESS_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSystemAdmin,
        businesses,
        selectedBusiness,
        selectBusiness,
        refreshBusinesses,
        signIn,
        signUp,
        signOut
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
