import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { AuthContextType, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [realIsSuperAdmin, setRealIsSuperAdmin] = useState(false);
  const [realIsSuperAdminLoading, setRealIsSuperAdminLoading] = useState(true);

  // Helper to map Supabase User to App UserProfile
  const mapUserToProfile = (supabaseUser: User): UserProfile => {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      username: supabaseUser.email?.split('@')[0] || 'user', // Fallback username
      role: (supabaseUser.user_metadata?.role as 'admin' | 'class_staff' | 'user') || 'user',
      display_name: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0],
      avatar_url: supabaseUser.user_metadata?.avatar_url,
      force_password_change: false, // Default
      created_at: supabaseUser.created_at,
      updated_at: supabaseUser.updated_at || supabaseUser.created_at,
      accent_preference: supabaseUser.user_metadata?.accent_preference || 'en-GB',
      class: supabaseUser.user_metadata?.class,
      // Default permissions to true for simplicity or based on role
      can_access_proofreading: true,
      can_access_spelling: true,
      can_access_learning_hub: true,
      can_access_spaced_repetition: true,
      proofreading_level: supabaseUser.user_metadata?.proofreading_level || 1,
      reading_level: supabaseUser.user_metadata?.reading_level || 1,
      spelling_level: supabaseUser.user_metadata?.spelling_level || 1,
      memorization_level: supabaseUser.user_metadata?.memorization_level || 1,
      voice_preference: supabaseUser.user_metadata?.voice_preference || null,
      navigation_permissions: {}, // Default empty
    };
  };

  const fetchFullProfile = async (userId: string): Promise<Partial<UserProfile>> => {
    try {
      const { data, error } = await (supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle() as any);

      if (error) {
        console.warn('[AuthContext] Error fetching full profile:', error);
        return {};
      }
      return data || {};
    } catch (err) {
      console.warn('[AuthContext] Exception fetching full profile:', err);
      return {};
    }
  };

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const profile = mapUserToProfile(session.user);
        setSessionUser(profile);
        
        // Fetch full profile
        fetchFullProfile(session.user.id).then(fullData => {
          setSessionUser((prev: UserProfile | null) => prev ? { ...prev, ...fullData } : null);
          setProfileLoaded(true);
          console.log(`[AuthContext] Session initialized. User ID: ${session.user.id}, Role: ${fullData.role || 'user'}`);
        }).catch(err => {
          console.error('[AuthContext] Initial profile fetch failed:', err);
          setProfileLoaded(true); // Still mark as loaded to unblock app
        }).finally(() => {
          setLoading(false);
        });
      } else {
        setSessionUser(null);
        setProfileLoaded(true);
        setLoading(false);
      }
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        const profile = mapUserToProfile(session.user);
        setSessionUser(profile);
        setProfileLoaded(false); // Reset on auth change
        setLoading(true);

        fetchFullProfile(session.user.id).then(fullData => {
          setSessionUser(prev => prev ? { ...prev, ...fullData } : null);
          setProfileLoaded(true);
        }).finally(() => {
          setLoading(false);
        });
      } else {
        setSessionUser(null);
        setProfileLoaded(true);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Proactive self-healing synchronization (Optimized)
  useEffect(() => {
    if (session?.user?.id && profileLoaded) {
      // Avoid redundant syncs in the same session
      const syncKey = `synced_${session.user.id}`;
      if (sessionStorage.getItem(syncKey)) {
        console.log('[AuthContext] User already synced in this session, skipping proactive check.');
        return;
      }

      console.log('[AuthContext] Session active, performing optimized self-sync check...');
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Pass metadata directly to avoid expensive getUserById call in Edge Function
      supabase.functions.invoke('user-management/sync-current-user', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anonKey
        },
        body: { 
          userId: session.user.id,
          email: session.user.email,
          metadata: session.user.user_metadata
        }
      }).then(() => {
        sessionStorage.setItem(syncKey, 'true');
      }).catch(err => {
        console.warn('[AuthContext] Proactive sync failed (non-critical):', err);
      });
    }
  }, [session?.user?.id, session?.access_token]);


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
    }
  }, [sessionUser]);

  const updateVoicePreference = useCallback(async (voiceName: string, voiceLang: string, voiceURI: string) => {
    if (!sessionUser) return;

    const voicePref = { voiceName, voiceLang, voiceURI };

    // Optimistic update
    setSessionUser(prev => prev ? { ...prev, voice_preference: voicePref } : null);

    // Save to user_metadata
    const { error } = await supabase.auth.updateUser({
      data: { voice_preference: voicePref }
    });

    if (error) {
      console.error('Failed to update voice preference', error);
    }
  }, [sessionUser]);

  const [isUserView, setIsUserView] = useState(false);
  const [isMobileEmulator, setIsMobileEmulator] = useState(false);
  const [testUserId, setTestUserId] = useState<string | null>(null);
  const [testUserPermissions, setTestUserPermissions] = useState<Record<string, boolean>>({});
  const [impersonatedAdminId, setImpersonatedAdminId] = useState<string | null>(null);

  // Fetch test user ID for impersonation when admin switches to user view
  useEffect(() => {
    if (sessionUser?.role === 'admin' && isUserView) {
      // Hardcoded test user ID for now as per app logic
      supabase
        .from('users' as any)
        .select('id, navigation_permissions')
        .eq('username', 'benedictcftsang@outlook.com')
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) {
            setTestUserId(data.id);
            if (data.navigation_permissions) {
              setTestUserPermissions(data.navigation_permissions as Record<string, boolean>);
            } else {
              setTestUserPermissions({});
            }
          }
        });
    } else if (!isUserView) {
      // Clear test user data when leaving user view
      setTestUserId(null);
      setTestUserPermissions({});
    }
  }, [sessionUser, isUserView]);

  // Check for super admin status for the real session user
  useEffect(() => {
    if (sessionUser?.id) {
      setRealIsSuperAdminLoading(true);
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      supabase.functions.invoke('auth/check-super-admin', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey
        },
        body: { adminUserId: sessionUser.id }
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
      setRealIsSuperAdminLoading(false);
    }
  }, [sessionUser?.id, session?.access_token]);

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
  const isClassStaff = sessionUser?.role === 'class_staff' && !isUserView;
  const isStaff = isAdmin || isClassStaff;
  const accentPreference = sessionUser?.accent_preference || 'en-GB';
  const voicePreference = sessionUser?.voice_preference || null;

  const [impersonatedAdminProfile, setImpersonatedAdminProfile] = useState<UserProfile | null>(null);

  // Fetch impersonated admin profile
  useEffect(() => {
    if (impersonatedAdminId) {
      (supabase
        .from('users' as any)
        .select('id,username,display_name,role,created_at,navigation_permissions')
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
              proofreading_level: profileData.proofreading_level || 1,
              reading_level: profileData.reading_level || 1,
              spelling_level: profileData.spelling_level || 1,
              voice_preference: profileData.voice_preference || null,
              navigation_permissions: profileData.navigation_permissions || {},
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
          role: 'user' as const, // Spoof as regular student
          navigation_permissions: testUserPermissions
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
    isLoading: loading || !profileLoaded,
    profileLoaded,
    signIn,
    signOut,
    changePassword,
    isAdmin,
    isClassStaff,
    isStaff,
    isUserView,
    toggleViewMode,
    isMobileEmulator,
    setIsMobileEmulator,
    accentPreference,
    voicePreference,
    updateAccentPreference,
    updateVoicePreference,
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
    isClassStaff,
    isStaff,
    isUserView,
    isMobileEmulator,
    accentPreference,
    voicePreference,
    updateAccentPreference,
    updateVoicePreference,
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
