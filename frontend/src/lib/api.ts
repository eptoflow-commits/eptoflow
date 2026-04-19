'use client';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

const USER_TOKEN_KEY  = 'eptoflow.user.token';
const ADMIN_TOKEN_KEY = 'eptoflow.admin.token';

export const tokens = {
  getUser:  () => typeof window === 'undefined' ? null : localStorage.getItem(USER_TOKEN_KEY),
  setUser:  (t: string) => localStorage.setItem(USER_TOKEN_KEY, t),
  clearUser: () => localStorage.removeItem(USER_TOKEN_KEY),
  getAdmin: () => typeof window === 'undefined' ? null : localStorage.getItem(ADMIN_TOKEN_KEY),
  setAdmin: (t: string) => localStorage.setItem(ADMIN_TOKEN_KEY, t),
  clearAdmin: () => localStorage.removeItem(ADMIN_TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status; this.code = code; this.details = details;
  }
}

type Opts = RequestInit & { auth?: 'user' | 'admin' | 'none' };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { auth = 'user', headers, ...rest } = opts;
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(headers as any) };
  if (auth === 'user') {
    const t = tokens.getUser();  if (t) h.Authorization = `Bearer ${t}`;
  } else if (auth === 'admin') {
    const t = tokens.getAdmin(); if (t) h.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: h });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = body?.error || { code: 'HTTP_' + res.status, message: res.statusText };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return body as T;
}
