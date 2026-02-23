import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { AuthContextType, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [realIsSuperAdmin, setRealIsSuperAdmin] = useState(false);
  const [realIsSuperAdminLoading, setRealIsSuperAdminLoading] = useState(true);

  // Helper to map Supabase User to App UserProfile
  const mapUserToProfile = (supabaseUser: User): UserProfile => {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      username: supabaseUser.email?.split('@')[0] || 'user', // Fallback username
      role: (supabaseUser.user_metadata?.role as 'admin' | 'user') || 'user',
      display_name: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0],
      avatar_url: supabaseUser.user_metadata?.avatar_url,
      force_password_change: false, // Default
      created_at: supabaseUser.created_at,
      updated_at: supabaseUser.updated_at || supabaseUser.created_at,
      accent_preference: supabaseUser.user_metadata?.accent_preference || 'en-US',
      class: supabaseUser.user_metadata?.class,
      // Default permissions to true for simplicity or based on role
      can_access_proofreading: true,
      can_access_spelling: true,
      can_access_learning_hub: true,
      can_access_spaced_repetition: true,
    };
  };

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setSessionUser(mapUserToProfile(session.user));
      } else {
        setSessionUser(null);
      }
      setLoading(false);
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setSessionUser(mapUserToProfile(session.user));
      } else {
        setSessionUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSessionUser(null);
    setSession(null);
  };

  const changePassword = async (
    _currentPassword: string | undefined, // Not used in standard update, but kept for signature compatibility
    newPassword: string,
    _verificationCode?: string
  ) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateAccentPreference = useCallback(async (accent: string) => {
    if (!sessionUser) return;

    // Optimistic update
    setSessionUser(prev => prev ? { ...prev, accent_preference: accent } : null);

    // Save to user_metadata (portable preference storage)
    const { error } = await supabase.auth.updateUser({
      data: { accent_preference: accent }
    });

    if (error) {
      console.error('Failed to update accent preference', error);
      // Revert if needed, but keeping simple for now
    }
  }, [sessionUser]);

  const [isUserView, setIsUserView] = useState(false);
  const [isMobileEmulator, setIsMobileEmulator] = useState(false);
  const [testUserId, setTestUserId] = useState<string | null>(null);
  const [impersonatedAdminId, setImpersonatedAdminId] = useState<string | null>(null);

  // Fetch test user ID for impersonation when admin switches to user view
  useEffect(() => {
    if (sessionUser?.role === 'admin' && isUserView && !testUserId) {
      supabase
        .from('users')
        .select('id')
        .eq('username', 'benedictcftsang@outlook.com')
        .maybeSingle()
        .then(({ data }) => {
          if (data) setTestUserId(data.id);
        });
    }
  }, [sessionUser, isUserView, testUserId]);

  // Check for super admin status for the real session user
  useEffect(() => {
    if (sessionUser?.id) {
      setRealIsSuperAdminLoading(true);
      supabase.functions.invoke('auth/check-super-admin', {
        body: { adminUserId: sessionUser.id },
      }).then(({ data }) => {
        if (data && data.isSuperAdmin) {
          setRealIsSuperAdmin(true);
          // Auto-sync the role in memory in case auth metadata is stale
          if (sessionUser.role !== 'admin') {
            setSessionUser(prev => prev ? { ...prev, role: 'admin' } : null);
          }
        } else {
          setRealIsSuperAdmin(false);
        }
      }).catch(err => {
        console.error('Failed to verify super admin status:', err);
        setRealIsSuperAdmin(false);
      }).finally(() => {
        setRealIsSuperAdminLoading(false);
      });
    } else {
      setRealIsSuperAdmin(false);
      setRealIsSuperAdminLoading(false);
    }
  }, [sessionUser?.id]);

  // Prevent impersonating yourself
  useEffect(() => {
    if (impersonatedAdminId && sessionUser?.id === impersonatedAdminId) {
      console.warn('Automatically clearing self-impersonation');
      setImpersonatedAdminId(null);
    }
  }, [impersonatedAdminId, sessionUser?.id]);

  const toggleViewMode = () => {
    setIsUserView(prev => !prev);
  };

  const isAdmin = sessionUser?.role === 'admin' && !isUserView;
  const accentPreference = sessionUser?.accent_preference || 'en-US';

  const [impersonatedAdminProfile, setImpersonatedAdminProfile] = useState<UserProfile | null>(null);

  // Fetch impersonated admin profile
  useEffect(() => {
    if (impersonatedAdminId) {
      (supabase
        .from('users')
        .select('id,username,display_name,role,created_at')
        .eq('id', impersonatedAdminId)
        .maybeSingle() as any)
        .then(({ data }: any) => {
          if (data && !('error' in data)) {
            const profileData = data as any;
            setImpersonatedAdminProfile({
              id: profileData.id,
              email: profileData.username,
              username: profileData.username?.split('@')[0] || 'admin',
              role: profileData.role as 'admin' | 'user',
              display_name: profileData.display_name || profileData.username?.split('@')[0],
              created_at: profileData.created_at,
              updated_at: profileData.created_at,
              can_access_proofreading: true,
              can_access_spelling: true,
              can_access_learning_hub: true,
              can_access_spaced_repetition: true,
            } as UserProfile);
          }
        });
    } else {
      setImpersonatedAdminProfile(null);
    }
  }, [impersonatedAdminId]);

  // Effective user for the rest of the app (allows admin to see test user assignments or impersonate other admins)
  const effectiveUser = useMemo(() => {
    if (sessionUser?.role === 'admin') {
      if (isUserView && testUserId) {
        return {
          ...sessionUser!,
          id: testUserId,
          email: 'benedictcftsang@outlook.com',
          username: 'test-user',
          display_name: 'Test Account',
          role: 'user' as const // Spoof as regular student
        };
      }
      if (impersonatedAdminProfile) {
        return impersonatedAdminProfile;
      }
    }
    return sessionUser;
  }, [sessionUser, isUserView, testUserId, impersonatedAdminProfile]);

  const value = useMemo(() => ({
    user: effectiveUser,
    profile: effectiveUser,
    session,
    loading,
    isLoading: loading,
    signIn,
    signOut,
    changePassword,
    isAdmin,
    isUserView,
    toggleViewMode,
    isMobileEmulator,
    setIsMobileEmulator,
    accentPreference,
    updateAccentPreference,
    impersonatedAdminId,
    setImpersonatedAdminId,
    isImpersonating: !!impersonatedAdminId,
    realUser: sessionUser,
    realIsAdmin: sessionUser?.role === 'admin',
    realIsSuperAdmin,
    realIsSuperAdminLoading
  }), [
    effectiveUser,
    session,
    loading,
    isAdmin,
    isUserView,
    isMobileEmulator,
    accentPreference,
    updateAccentPreference,
    impersonatedAdminId,
    sessionUser,
    realIsSuperAdmin,
    realIsSuperAdminLoading
  ]);
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
