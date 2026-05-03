'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Subscription } from '@/lib/types';

const PLANS = {
  basic: {
    label: 'Basic',
    price: '₹249',
    color: 'from-blue-500 to-brand-600',
    features: ['1 solenoid valve', '1 relay output', 'Manual ON/OFF control', 'Scheduling'],
  },
  premium: {
    label: 'Premium',
    price: '₹499',
    color: 'from-purple-500 to-indigo-600',
    features: ['3 solenoid valves', 'Moisture sensor & automation', '1 relay output', 'Scheduling', 'Voice control'],
  },
};

export default function SubscriptionPage() {
  const router = useRouter();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    api<{ subscription: Subscription | null }>('/api/subscriptions/me')
      .then(r => setSub(r.subscription));
  }, []);

  const requestPremium = async () => {
    setRequesting(true);
    try {
      await api('/api/subscriptions/request-upgrade', { method: 'POST' });
      setRequested(true);
    } catch {}
    finally { setRequesting(false); }
  };

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Choose your plan</h1>
      <p className="text-sm text-gray-500 mb-4">Prices are exclusive of GST · 30-day cycle</p>

      {/* Current plan banner */}
      {sub?.isActive && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div>
            <div className="text-sm font-semibold text-brand-800 capitalize">You're on the {sub.plan_name} plan</div>
            <div className="text-xs text-brand-600">{sub.daysRemaining} days remaining · ends {new Date(sub.end_date).toLocaleDateString('en-IN')}</div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Basic Plan — directly payable */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`bg-gradient-to-r ${PLANS.basic.color} p-4 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">{PLANS.basic.label}</div>
                <div className="text-blue-100 text-sm">Most popular</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{PLANS.basic.price}</div>
                <div className="text-blue-100 text-xs">+ GST / 30 days</div>
              </div>
            </div>
          </div>
          <div className="p-4">
            <ul className="space-y-2 mb-4">
              {PLANS.basic.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-brand-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => router.push('/payment?plan=basic')}
              className="btn-primary w-full py-2.5"
            >
              Pay ₹249 online →
            </button>
          </div>
        </div>

        {/* Premium Plan — greyed out, request only */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
          <div className={`bg-gradient-to-r ${PLANS.premium.color} p-4 text-white opacity-70`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">{PLANS.premium.label}</div>
                <div className="text-purple-200 text-sm">Request required</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{PLANS.premium.price}</div>
                <div className="text-purple-200 text-xs">+ GST / 30 days</div>
              </div>
            </div>
          </div>
          <div className="p-4 opacity-70">
            <ul className="space-y-2 mb-4">
              {PLANS.premium.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-purple-500 font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px]">
            {requested ? (
              <div className="text-center px-6">
                <div className="text-3xl mb-2">📩</div>
                <div className="font-semibold text-gray-800">Request sent!</div>
                <div className="text-sm text-gray-500 mt-1">Our admin will reach out to you soon.</div>
              </div>
            ) : (
              <div className="text-center px-6">
                <div className="text-3xl mb-2">🔒</div>
                <div className="text-sm text-gray-700 font-medium mb-3">Premium requires admin approval</div>
                <button
                  onClick={requestPremium}
                  disabled={requesting}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {requesting ? 'Sending…' : 'Request Premium Upgrade'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        Payment is manually verified within 24 hours of submission.
      </p>
    </AppShell>
  );
}
