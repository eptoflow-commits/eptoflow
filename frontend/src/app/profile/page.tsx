'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Subscription } from '@/lib/types';

export default function ProfilePage() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  useEffect(() => {
    api<{ subscription: Subscription | null }>('/api/subscriptions/me').then(r => setSub(r.subscription));
  }, []);
  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Profile</h1>
      <div className="card space-y-2">
        <div><span className="text-gray-500 text-sm">Name</span><div>{user?.full_name}</div></div>
        <div><span className="text-gray-500 text-sm">Email</span><div>{user?.email}</div></div>
        {user?.phone && <div><span className="text-gray-500 text-sm">Phone</span><div>{user.phone}</div></div>}
      </div>
      <div className="card mt-3">
        <div className="text-sm text-gray-500">Subscription</div>
        {sub ? (
          <div>
            <div className="font-semibold capitalize">{sub.plan_name}</div>
            <div className="text-xs text-gray-500">
              Status: {sub.status} · Ends {new Date(sub.end_date).toLocaleDateString()}
              {sub.isActive && ` · ${sub.daysRemaining} days left`}
            </div>
          </div>
        ) : <div className="text-gray-500 text-sm">None</div>}
      </div>
    </AppShell>
  );
}
