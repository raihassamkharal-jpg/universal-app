import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, updateUserPresence } from '../lib/supabase/client';
import type { Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isConfigured: boolean;
  oauthError: string | null;
  clearOAuthError: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<{ error: string | null; emailConfirmationRequired?: boolean }>;
  signInDemo: (targetUsername?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearOAuthError = useCallback(() => {
    setOauthError(null);
  }, []);

  // Helper to ensure profile exists for any authenticated user (especially Google OAuth users)
  const syncUserProfile = useCallback(async (u: User): Promise<Profile | null> => {
    if (!isSupabaseConfigured) return null;

    try {
      // 1. Try to fetch existing profile
      const { data: existing, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .maybeSingle();

      if (existing && !fetchErr) {
        return existing as Profile;
      }

      // 2. Profile missing (e.g., initial Google sign-in)
      const meta = u.user_metadata || {};
      const emailPrefix = u.email ? u.email.split('@')[0] : '';
      const rawUserCandidate =
        meta.username ||
        meta.preferred_username ||
        emailPrefix ||
        `user_${u.id.slice(0, 8)}`;

      const cleanCandidate = rawUserCandidate
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 18);

      const baseUsername =
        cleanCandidate.length >= 3 ? cleanCandidate : `user_${u.id.slice(0, 6)}`;

      // Generate unique username
      let finalUsername = baseUsername;
      let attempts = 0;
      while (attempts < 6) {
        const { data: taken } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', finalUsername)
          .maybeSingle();

        if (!taken || taken.id === u.id) {
          break;
        }

        finalUsername = `${baseUsername.slice(0, 15)}_${Math.floor(1000 + Math.random() * 9000)}`;
        attempts++;
      }

      const displayName =
        meta.full_name ||
        meta.name ||
        meta.display_name ||
        (u.email ? u.email.split('@')[0] : finalUsername);

      const avatarUrl = meta.avatar_url || meta.picture || null;
      const now = new Date().toISOString();

      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .upsert({
          id: u.id,
          username: finalUsername,
          display_name: displayName,
          avatar_url: avatarUrl,
          status: 'Hey there! I am using Universal.',
          last_seen: now,
          updated_at: now,
        })
        .select('*')
        .single();

      if (insertErr) {
        console.error('Failed to create OAuth user profile:', insertErr);
      }

      if (created) {
        return created as Profile;
      }

      return null;
    } catch (err) {
      console.error('syncUserProfile exception:', err);
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        // Try fallback sync
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user && authUser.user.id === userId) {
          return await syncUserProfile(authUser.user);
        }
        return null;
      }

      return data as Profile;
    } catch (err) {
      console.error('Fetch profile failed:', err);
      return null;
    }
  }, [syncUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const p = await fetchProfile(user.id);
      if (p) setProfile(p);
    }
  }, [user?.id, fetchProfile]);

  // Initial session load & OAuth callback handling
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Check URL parameters for OAuth errors (e.g., user pressed cancel in Google consent)
    const checkUrlForErrors = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith('#')
            ? window.location.hash.substring(1)
            : window.location.hash
        );

        const errorDesc =
          searchParams.get('error_description') || hashParams.get('error_description');
        const errorCode = searchParams.get('error') || hashParams.get('error');

        if (errorDesc || errorCode) {
          const message =
            errorCode === 'access_denied'
              ? 'Google sign-in was cancelled.'
              : errorDesc || `Authentication error: ${errorCode}`;
          setOauthError(message);
          // Clean URL without reloading
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {
        // Ignore URL parsing errors
      }
    };

    checkUrlForErrors();

    async function initAuth() {
      try {
        // Check for active demo session first
        const storedDemo = localStorage.getItem('universal_demo_session');
        if (storedDemo) {
          try {
            const parsed = JSON.parse(storedDemo);
            if (parsed.user && parsed.profile && isMounted) {
              setUser(parsed.user);
              setProfile(parsed.profile);
              setLoading(false);
              return;
            }
          } catch {}
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && isMounted) {
          setUser(session.user);
          let p = await fetchProfile(session.user.id);
          if (!p && isMounted) {
            p = await syncUserProfile(session.user);
          }
          if (isMounted) setProfile(p);
          updateUserPresence(session.user.id);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);
        let p = await fetchProfile(session.user.id);
        if (!p && isMounted) {
          p = await syncUserProfile(session.user);
        }
        if (isMounted) setProfile(p);
        updateUserPresence(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, syncUserProfile]);

  // Presence heartbeat (every 60s while logged in)
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
      return;
    }

    // Send initial ping
    updateUserPresence(user.id);

    // Heartbeat every 60 seconds
    presenceIntervalRef.current = setInterval(() => {
      if (user?.id) {
        updateUserPresence(user.id);
      }
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        updateUserPresence(user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  // Sign In with email and password
  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Messaging service is temporarily unavailable. Please try again shortly.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Incorrect email or password. Please verify and try again.' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { error: 'Please check your email inbox to verify your account before logging in.' };
        }
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        let p = await fetchProfile(data.user.id);
        if (!p) {
          p = await syncUserProfile(data.user);
        }
        setProfile(p);
      }

      return { error: null };
    } catch {
      return { error: 'Network error. Please check your internet connection and try again.' };
    }
  };

  // Sign In with Google OAuth
  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Messaging service is temporarily unavailable. Please try again shortly.' };
    }

    try {
      setOauthError(null);
      const redirectTo = window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        let friendlyMsg = error.message;
        if (
          error.message.includes('provider is not enabled') ||
          error.message.includes('validation_failed') ||
          (error as any).code === 'validation_failed'
        ) {
          friendlyMsg =
            'Google Sign-In is not currently enabled on this Supabase project. To enable it, navigate to Supabase Dashboard → Authentication → Providers → Google and toggle it ON, or sign in using your email/password or Instant Demo Access below.';
        }
        setOauthError(friendlyMsg);
        return { error: friendlyMsg };
      }

      return { error: null };
    } catch (err: any) {
      const msg = err?.message || 'Failed to initialize Google login. Please try again.';
      setOauthError(msg);
      return { error: msg };
    }
  };

  // Sign Up with email, password, username, display name
  const signUp = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ): Promise<{ error: string | null; emailConfirmationRequired?: boolean }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Messaging service is temporarily unavailable. Please try again shortly.' };
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

    // Validate username syntax
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      return {
        error: 'Username must be between 3 and 24 characters and only contain letters, numbers, and underscores.',
      };
    }

    try {
      // Check username availability
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        // Table might not be ready or search error
      } else if (existing) {
        return { error: `Username @${cleanUsername} is already taken. Please pick another one.` };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: displayName.trim() || cleanUsername,
            avatar_url: null,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        // If session was returned immediately (auto-confirm enabled)
        if (data.session) {
          setUser(data.user);
          // Explicitly upsert profile record to guarantee it exists even before triggers run
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: cleanUsername,
            display_name: displayName.trim() || cleanUsername,
            avatar_url: null,
            last_seen: new Date().toISOString(),
          });
          const p = await fetchProfile(data.user.id);
          setProfile(p);
          return { error: null, emailConfirmationRequired: false };
        } else {
          // Email confirmation is required by Supabase auth settings
          return { error: null, emailConfirmationRequired: true };
        }
      }

      return { error: null };
    } catch {
      return { error: 'Network error during registration. Please try again.' };
    }
  };

  // Sign In Demo Mode for instant one-click testing
  const signInDemo = async (targetUsername?: string) => {
    const handle = (targetUsername || 'alex_demo').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const demoId = `demo-user-${handle}`;
    const now = new Date().toISOString();

    const demoUser: User = {
      id: demoId,
      app_metadata: { provider: 'demo' },
      user_metadata: { username: handle, full_name: 'Alex Demo' },
      aud: 'authenticated',
      created_at: now,
      email: `${handle}@universal.app`,
      phone: '',
      role: 'authenticated',
      updated_at: now,
    };

    const demoProfile: Profile = {
      id: demoId,
      username: handle,
      display_name: 'Alex Demo',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: 'Connecting globally on Universal 🌐',
      last_seen: now,
      created_at: now,
      updated_at: now,
    };

    localStorage.setItem(
      'universal_demo_session',
      JSON.stringify({ user: demoUser, profile: demoProfile })
    );

    setUser(demoUser);
    setProfile(demoProfile);
    setLoading(false);
  };

  // Sign Out
  const signOut = async () => {
    localStorage.removeItem('universal_demo_session');

    if (!isSupabaseConfigured) {
      setUser(null);
      setProfile(null);
      return;
    }

    try {
      if (user?.id && !user.id.startsWith('demo-')) {
        await updateUserPresence(user.id);
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  // Update profile
  const updateProfile = async (data: Partial<Profile>): Promise<{ error: string | null }> => {
    if (!user?.id) {
      return { error: 'You must be signed in to update your profile.' };
    }

    if (user.id.startsWith('demo-') && profile) {
      const updatedProfile: Profile = {
        ...profile,
        ...data,
        updated_at: new Date().toISOString(),
      };
      setProfile(updatedProfile);
      localStorage.setItem(
        'universal_demo_session',
        JSON.stringify({ user, profile: updatedProfile })
      );
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: 'Service unavailable' };
    }

    try {
      const updates: any = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      if (data.display_name !== undefined) updates.display_name = data.display_name?.trim() || '';
      if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url;
      if (data.status !== undefined) updates.status = data.status ? data.status.trim() : null;

      if (data.username !== undefined) {
        const clean = data.username.trim().toLowerCase().replace(/^@/, '');
        if (!/^[a-z0-9_]{3,24}$/.test(clean)) {
          return {
            error: 'Username must be 3-24 characters containing only letters, numbers, and underscores.',
          };
        }

        // Check if username is taken by another user
        const { data: taken } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', clean)
          .neq('id', user.id)
          .maybeSingle();

        if (taken) {
          return { error: `Username @${clean} is already taken. Please choose a different one.` };
        }

        updates.username = clean;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        return { error: error.message };
      }

      await refreshProfile();
      return { error: null };
    } catch {
      return { error: 'Failed to update profile. Please try again.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isConfigured: isSupabaseConfigured,
        oauthError,
        clearOAuthError,
        signIn,
        signInWithGoogle,
        signUp,
        signInDemo,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
