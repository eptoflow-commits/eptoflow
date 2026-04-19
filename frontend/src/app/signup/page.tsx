'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [full_name, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await signup({ full_name, email, phone: phone || undefined, password });
      router.replace('/subscription');
    } catch (e: any) { setErr(e.message || 'Signup failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-brand-50">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-brand-700">Create your account</h1>
        {err && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{err}</div>}
        <div>
          <label className="label">Full name</label>
          <input className="input" value={full_name} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Phone (optional)</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" minLength={8}
                 value={password} onChange={(e) => setPassword(e.target.value)} required />
          <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-sm text-gray-600 text-center">
          Already have one? <Link href="/login" className="text-brand-700 font-medium">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
