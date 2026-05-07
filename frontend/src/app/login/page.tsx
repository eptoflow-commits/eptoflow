'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (e: any) { setErr(e.message || 'Login failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo.jpeg" alt="Eptoflow" style={{ width: '100%', maxWidth: 280, height: 'auto' }} />
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 space-y-4">
          <div className="text-center mb-2">
            <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your Eptoflow account</p>
          </div>
          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <span>⚠️</span> {err}
            </div>
          )}
          <div>
            <label className="label">Email address</label>
            <input className="input" type="email" value={email} placeholder="you@example.com"
                   onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} placeholder="••••••••"
                   onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-xs text-center text-gray-400">
            Access is provided by your administrator.
          </p>
        </form>
      </div>
    </div>
  );
}
