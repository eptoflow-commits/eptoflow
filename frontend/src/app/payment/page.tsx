'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

const PLAN_INFO: Record<string, { amount: string; label: string }> = {
  basic:   { amount: '₹249', label: 'Basic' },
  premium: { amount: '₹499', label: 'Premium' },
};

function PaymentInner() {
  const params = useSearchParams();
  const router = useRouter();
  const plan = (params.get('plan') as 'basic' | 'premium') || 'basic';
  const info = PLAN_INFO[plan] || PLAN_INFO.basic;

  const [step, setStep] = useState<'pay' | 'confirm'>('pay');
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
        body: JSON.stringify({ plan, payment_reference: reference || undefined, screenshot_url_or_note: note || undefined }),
      });
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-3">
        <div className="text-5xl">🎉</div>
        <h2 className="text-lg font-bold text-gray-900">Payment submitted!</h2>
        <p className="text-sm text-gray-600">
          Your <b>{info.label}</b> plan payment is under review. We'll activate it within 24 hours.
        </p>
        <button className="btn-primary w-full mt-2" onClick={() => router.push('/dashboard')}>
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan summary */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-brand-100 text-xs uppercase tracking-wide">Subscribing to</div>
            <div className="text-xl font-bold mt-0.5">{info.label} Plan</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{info.amount}</div>
            <div className="text-brand-100 text-xs">+ GST / 30 days</div>
          </div>
        </div>
      </div>

      {step === 'pay' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">Step 1 — Make payment</h2>
          <p className="text-sm text-gray-600">
            Pay <strong>{info.amount} + GST</strong> using UPI, bank transfer, or any online method to:
          </p>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">UPI ID</span>
              <span className="font-mono font-semibold text-gray-800">eptosicare@okicici</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-semibold text-gray-800">Eptoflow</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount</span>
              <span className="font-semibold text-gray-800">{info.amount} + GST</span>
            </div>
          </div>
          <button className="btn-primary w-full py-2.5" onClick={() => setStep('confirm')}>
            I've made the payment →
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">Step 2 — Submit reference</h2>
          <p className="text-sm text-gray-600">Enter your UPI transaction ID or reference so we can verify your payment.</p>
          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">⚠️ {err}</div>
          )}
          <div>
            <label className="label">Transaction ID / Reference <span className="text-red-500">*</span></label>
            <input className="input" value={reference} required
                   placeholder="e.g. 123456789012" onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <label className="label">Additional note (optional)</label>
            <textarea className="input min-h-[70px]" value={note}
                      placeholder="Screenshot URL, bank name, etc."
                      onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for verification'}
          </button>
          <button type="button" className="text-sm text-gray-400 w-full text-center" onClick={() => setStep('pay')}>
            ← Back
          </button>
        </form>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <AppShell>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Online Payment</h1>
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading…</div>}>
        <PaymentInner />
      </Suspense>
    </AppShell>
  );
}
