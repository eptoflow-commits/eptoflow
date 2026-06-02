'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Totals = {
  users: number; active_subscriptions: number; expired_subscriptions: number;
  pending_payments: number; online_devices: number; offline_devices: number;
  premium_requests: number; new_contacts: number; addon_requests: number;
};

const STAT_CARDS = [
  { key: 'addon_requests',       label: 'Addon Requests',     icon: '⚡', color: 'bg-purple-50 text-purple-700', href: '/admin/addon-requests' },
  { key: 'new_contacts',         label: 'New Contacts',       icon: '📬', color: 'bg-red-50 text-red-700',      href: '/admin/contact-requests' },
  { key: 'users',                label: 'Total Users',        icon: '👥', color: 'bg-blue-50 text-blue-700',    href: '/admin/users' },
  { key: 'online_devices',       label: 'Online Devices',     icon: '📡', color: 'bg-green-50 text-green-700',  href: '/admin/devices' },
  { key: 'active_subscriptions', label: 'Active Plans',       icon: '✅', color: 'bg-brand-50 text-brand-700', href: '/admin/subscriptions' },
  { key: 'pending_payments',     label: 'Pending Payments',   icon: '💳', color: 'bg-amber-50 text-amber-700',  href: '/admin/payments' },
  { key: 'expired_subscriptions',label: 'Expired Plans',      icon: '⏰', color: 'bg-purple-50 text-purple-700', href: '/admin/subscriptions' },
];

export default function AdminDashboard() {
  const [t, setT] = useState<Totals | null>(null);
  useEffect(() => {
    api<{ totals: Totals }>('/api/admin/dashboard', { auth: 'admin' }).then(r => setT(r.totals));
  }, []);

  if (!t) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-gray-900 text-lg">Overview</h2>
        <p className="text-sm text-gray-500">Platform snapshot</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {STAT_CARDS.map((c) => (
          <Link key={c.key} href={c.href}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">{c.label}</span>
              <span className="text-xl">{c.icon}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
              {t[c.key as keyof Totals]}
            </div>
            {c.key === 'addon_requests' && t.addon_requests > 0 && (
              <div className="mt-1 text-xs text-purple-600 font-medium">Activate outputs →</div>
            )}
            {c.key === 'new_contacts' && t.new_contacts > 0 && (
              <div className="mt-1 text-xs text-red-600 font-medium">Needs follow-up →</div>
            )}
            {c.key === 'pending_payments' && t.pending_payments > 0 && (
              <div className="mt-1 text-xs text-amber-600 font-medium">Needs review →</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
