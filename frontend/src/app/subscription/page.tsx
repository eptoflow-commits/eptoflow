'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Plan, Subscription } from '@/lib/types';

const PLAN_LABELS: Record<string, { price: string; features: string[] }> = {
  basic: {
    price: '₹249 + GST / 30 days',
    features: ['1 solenoid valve', '1 relay output', 'Manual ON/OFF control', 'Scheduling'],
  },
  premium: {
    price: '₹499 + GST / 30 days',
    features: ['3 solenoid valves', 'Moisture sensor & automation', '1 relay output', 'Scheduling', 'Voice control'],
  },
};

export default function SubscriptionPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    api<{ subscription: Subscription | null; plan: Plan | null; plans_catalog: any }>
      ('/api/subscriptions/me').then(r => { setSub(r.subscription); setPlan(r.plan); });
  }, []);

  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Subscription</h1>

      {sub ? (
        <div className="card mb-4">
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-gray-500">Current plan</div>
              <div className="text-lg font-semibold capitalize">{sub.plan_name}</div>
            </div>
            <div className="text-right">
              {sub.isActive
                ? <span className="badge-green">{sub.daysRemaining} days left</span>
                : <span className="badge-red">Inactive</span>}
              <div className="text-xs text-gray-500 mt-1">ends {new Date(sub.end_date).toLocaleDateString('en-IN')}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-4 text-sm text-gray-600">You have no active subscription.</div>
      )}

      <h2 className="font-semibold mb-2">Choose a plan</h2>
      <div className="grid gap-3">
        {(['basic', 'premium'] as const).map((name) => {
          const info = PLAN_LABELS[name];
          const isCurrent = sub?.plan_name === name && sub?.isActive;
          return (
            <div key={name} className={`card ${isCurrent ? 'border-brand-400' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold capitalize">{name}
                    {isCurrent && <span className="ml-2 text-xs font-normal badge-green">Active</span>}
                  </div>
                  <div className="text-sm text-brand-700 font-medium">{info.price}</div>
                </div>
                <Link href={`/payment?plan=${name}`} className="btn-primary">
                  {isCurrent ? 'Renew' : 'Activate'}
                </Link>
              </div>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                {info.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <span className="text-brand-500">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Prices are exclusive of GST. Payment is verified manually within 24 hours.
      </p>
    </AppShell>
  );
}
