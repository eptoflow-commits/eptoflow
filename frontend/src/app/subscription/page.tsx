'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Plan, Subscription } from '@/lib/types';

export default function SubscriptionPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [catalog, setCatalog] = useState<{ basic: any; premium: any } | null>(null);

  useEffect(() => {
    api<{ subscription: Subscription | null; plan: Plan | null; plans_catalog: any }>
      ('/api/subscriptions/me').then(r => { setSub(r.subscription); setPlan(r.plan); setCatalog(r.plans_catalog); });
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
              <div className="text-xs text-gray-500 mt-1">ends {new Date(sub.end_date).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-4 text-sm text-gray-600">You have no subscription yet.</div>
      )}

      <h2 className="font-semibold mb-2">Choose a plan</h2>
      <div className="grid gap-3">
        {catalog && (['basic', 'premium'] as const).map((name) => {
          const p = catalog[name];
          return (
            <div key={name} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold capitalize">{name}</div>
                  <div className="text-sm text-gray-500">${p.amount.toFixed(2)} / 30 days</div>
                </div>
                <Link href={`/payment?plan=${name}`} className="btn-primary">Activate</Link>
              </div>
              <ul className="text-sm text-gray-700 mt-2 list-disc list-inside space-y-1">
                <li>Up to {p.maxValves} valve(s)</li>
                {p.hasRelay1 && <li>Relay 1 (motor / light)</li>}
                {p.hasMoisture && <li>Moisture sensor + automation</li>}
                {p.hasVoice && <li>In-app voice control</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
