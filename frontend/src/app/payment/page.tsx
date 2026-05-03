'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

function PaymentInner() {
  const params = useSearchParams();
  const router = useRouter();
  const plan = (params.get('plan') as 'basic' | 'premium') || 'basic';
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api('/api/subscriptions/payment-intent', {
        method: 'POST',
        body: JSON.stringify({
          plan,
          payment_reference: reference || undefined,
          screenshot_url_or_note: note || undefined,
        }),
      });
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="card">
        <h2 className="font-semibold mb-2">Payment submitted</h2>
        <p className="text-sm text-gray-700">
          Thank you. An administrator will verify your payment manually and activate your
          {' '}<b>{plan}</b> subscription. You will get a notification when it is approved.
        </p>
        <button className="btn-primary mt-3" onClick={() => router.push('/dashboard')}>Go to dashboard</button>
      </div>
    );
  }

  const planAmount = plan === 'premium' ? '₹499' : '₹249';

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Plan</div>
          <div className="text-lg font-semibold capitalize">{plan}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-brand-700">{planAmount}</div>
          <div className="text-xs text-gray-400">+ GST / 30 days</div>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        Pay via UPI, bank transfer, or any preferred method and submit the transaction
        reference below. Our team will verify and activate your plan within 24 hours.
      </p>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div>
        <label className="label">Payment reference / transaction ID</label>
        <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      <div>
        <label className="label">Note or screenshot URL (optional)</label>
        <textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit for verification'}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Submit payment</h1>
      <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
        <PaymentInner />
      </Suspense>
    </AppShell>
  );
}
