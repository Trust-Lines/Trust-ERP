import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api, ApiError } from './api';

/** GET /api/mobile/me — the role and the web pages (modules) that role may open. */
export interface Me {
  id: string;
  fullName: string;
  email: string;
  role: string;
  pages: string[];
}

interface AuthState {
  ready: boolean;
  session: Session | null;
  me: Me | null;
  meError: string | null;
  can: (pageKey: string) => boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reloadMe: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  const [nonce, setNonce] = useState(0);
  const reloadMe = useCallback(async () => setNonce(n => n + 1), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    api<Me>('/api/mobile/me').then(
      m => { if (live) { setMe(m); setMeError(null); } },
      async e => {
        if (!live) return;
        setMeError(e instanceof Error ? e.message : 'Profil yüklenemedi');
        // A deactivated / deleted account must not stay signed in on the device.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) await supabase.auth.signOut();
      },
    );
    return () => { live = false; };
  }, [userId, nonce]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (!error) return null;
    return /invalid login credentials/i.test(error.message) ? 'E-posta veya şifre hatalı.' : error.message;
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);
  // A profile loaded for a previous account never leaks into the next sign-in.
  const current = me && me.id === userId ? me : null;
  const can = useCallback((key: string) => !!current?.pages.includes(key), [current]);

  return (
    <Ctx.Provider value={{ ready, session, me: current, meError, can, signIn, signOut, reloadMe }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
