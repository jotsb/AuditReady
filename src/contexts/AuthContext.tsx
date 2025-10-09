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
  userRole: 'owner' | 'manager' | 'member' | null;
  selectBusiness: (business: Business | null) => void;
  refreshBusinesses: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; requiresMFA?: boolean }>;
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
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'member' | null>(null);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('system_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    setIsSystemAdmin(!!data);
  };

  const loadUserRole = async (userId: string, businessId: string) => {
    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .maybeSingle();

      if (business && business.owner_id === userId) {
        setUserRole('owner');
        return;
      }

      const { data: memberData } = await supabase
        .from('business_members')
        .select('role')
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (memberData) {
        setUserRole(memberData.role);
      } else {
        setUserRole(null);
      }
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole(null);
    }
  };

  const loadBusinesses = async (userId: string) => {
    try {
      const { data: ownedBusinesses, error: ownedError } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (ownedError) throw ownedError;

      const { data: memberData, error: memberError } = await supabase
        .from('business_members')
        .select('business_id, businesses(*)')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      const memberBusinesses = memberData?.map((m: any) => m.businesses).filter(Boolean) || [];
      const allBusinesses = [...(ownedBusinesses || []), ...memberBusinesses];

      const uniqueBusinesses = Array.from(
        new Map(allBusinesses.map(b => [b.id, b])).values()
      );

      setBusinesses(uniqueBusinesses);

      const savedBusinessId = localStorage.getItem(SELECTED_BUSINESS_KEY);
      if (savedBusinessId && uniqueBusinesses.length > 0) {
        const savedBusiness = uniqueBusinesses.find(b => b.id === savedBusinessId);
        if (savedBusiness) {
          setSelectedBusiness(savedBusiness);
          await loadUserRole(userId, savedBusinessId);
        } else if (uniqueBusinesses.length > 0) {
          setSelectedBusiness(uniqueBusinesses[0]);
          localStorage.setItem(SELECTED_BUSINESS_KEY, uniqueBusinesses[0].id);
          await loadUserRole(userId, uniqueBusinesses[0].id);
        }
      } else if (uniqueBusinesses.length > 0) {
        setSelectedBusiness(uniqueBusinesses[0]);
        localStorage.setItem(SELECTED_BUSINESS_KEY, uniqueBusinesses[0].id);
        await loadUserRole(userId, uniqueBusinesses[0].id);
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

  const selectBusiness = async (business: Business | null) => {
    setSelectedBusiness(business);
    if (business) {
      localStorage.setItem(SELECTED_BUSINESS_KEY, business.id);
      if (user) {
        await loadUserRole(user.id, business.id);
      }
    } else {
      localStorage.removeItem(SELECTED_BUSINESS_KEY);
      setUserRole(null);
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

    if (error) {
      logger.auth('sign_in', false, { email, method: 'password', error: error?.message });
      return { error };
    }

    // Check if MFA is required by looking at the session's aal (Authentication Assurance Level)
    // aal1 = password only, aal2 = password + MFA
    if (data.user && data.session) {
      const currentAAL = data.session.aal;

      // List MFA factors to see if user has MFA enabled
      const { data: { factors } } = await supabase.auth.mfa.listFactors();

      // If user has verified factors but current AAL is only 1, MFA verification is needed
      const hasVerifiedFactors = factors && factors.some(f => f.status === 'verified');

      if (hasVerifiedFactors && currentAAL === 'aal1') {
        // MFA is required - don't proceed with login
        logger.auth('mfa_challenge_required', true, { email, method: 'password', aal: currentAAL });
        return { error: null, requiresMFA: true };
      }

      // No MFA required or already verified, proceed with normal checks
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
      logger.auth('sign_in', true, { email, method: 'password', aal: currentAAL });
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
        userRole,
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
