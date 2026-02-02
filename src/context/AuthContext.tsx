import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContextType, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
        setUser(mapUserToProfile(session.user));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser(mapUserToProfile(session.user));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
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
    setUser(null);
    setSession(null);
  };

  const changePassword = async (
    currentPassword: string | undefined, // Not used in standard update, but kept for signature compatibility
    newPassword: string,
    verificationCode?: string
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

  const updateAccentPreference = async (accent: string) => {
    if (!user) return;

    // Optimistic update
    setUser(prev => prev ? { ...prev, accent_preference: accent } : null);

    // Save to user_metadata (portable preference storage)
    const { error } = await supabase.auth.updateUser({
      data: { accent_preference: accent }
    });

    if (error) {
      console.error('Failed to update accent preference', error);
      // Revert if needed, but keeping simple for now
    }
  };

  const isAdmin = user?.role === 'admin';
  const accentPreference = user?.accent_preference || 'en-US';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: user,
        session,
        loading,
        isLoading: loading,
        signIn,
        signOut,
        changePassword,
        isAdmin,
        accentPreference,
        updateAccentPreference,
      }}
    >
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
