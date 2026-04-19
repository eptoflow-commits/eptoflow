'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    <div className="min-h-screen flex items-center justify-center px-6 bg-brand-50">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-brand-700">Sign in to Eptoflow</h1>
        {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-sm text-gray-600 text-center">
          New here? <Link href="/signup" className="text-brand-700 font-medium">Create account</Link>
        </p>
      </form>
    </div>
  );
}
