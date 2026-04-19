'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokens } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    try {
      const r = await api<{ token: string }>(
        '/api/auth/admin/login',
        { method: 'POST', body: JSON.stringify({ email, password }), auth: 'none' }
      );
      tokens.setAdmin(r.token);
      router.replace('/admin');
    } catch (e: any) { setErr(e.message || 'Login failed'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900 text-white">
      <form onSubmit={submit} className="bg-white text-gray-900 rounded-xl p-6 w-full max-w-sm space-y-3 shadow-xl">
        <h1 className="text-lg font-semibold">Admin sign in</h1>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn-primary w-full">Sign in</button>
      </form>
    </div>
  );
}
