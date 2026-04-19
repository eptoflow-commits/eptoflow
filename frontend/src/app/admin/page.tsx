'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Totals = {
  users: number; active_subscriptions: number; expired_subscriptions: number;
  pending_payments: number; online_devices: number; offline_devices: number;
};

export default function AdminDashboard() {
  const [t, setT] = useState<Totals | null>(null);
  useEffect(() => {
    api<{ totals: Totals }>('/api/admin/dashboard', { auth: 'admin' }).then(r => setT(r.totals));
  }, []);
  if (!t) return <div className="text-gray-500">Loading…</div>;
  const cards = [
    { l: 'Users', v: t.users },
    { l: 'Active subs', v: t.active_subscriptions },
    { l: 'Expired subs', v: t.expired_subscriptions },
    { l: 'Pending payments', v: t.pending_payments },
    { l: 'Online devices', v: t.online_devices },
    { l: 'Offline devices', v: t.offline_devices },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.l} className="card">
          <div className="text-xs text-gray-500">{c.l}</div>
          <div className="text-3xl font-semibold mt-1">{c.v}</div>
        </div>
      ))}
    </div>
  );
}
