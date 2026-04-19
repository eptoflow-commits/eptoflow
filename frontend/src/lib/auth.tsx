'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokens } from './api';
import type { User } from './types';

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (v: { full_name: string; email: string; phone?: string; password: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      if (!tokens.getUser()) { setUser(null); return; }
      const { user } = await api<{ user: User }>('/api/auth/me');
      setUser(user);
    } catch { setUser(null); tokens.clearUser(); }
  };

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  const login = async (email: string, password: string) => {
    const res = await api<{ user: User; token: string }>(
      '/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }), auth: 'none' }
    );
    tokens.setUser(res.token);
    setUser(res.user);
  };
  const signup: AuthCtx['signup'] = async (v) => {
    const res = await api<{ user: User; token: string }>(
      '/api/auth/signup', { method: 'POST', body: JSON.stringify(v), auth: 'none' }
    );
    tokens.setUser(res.token);
    setUser(res.user);
  };
  const logout = () => { tokens.clearUser(); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, signup, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
};
