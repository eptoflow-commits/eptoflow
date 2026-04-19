'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Device, Subscription, Notification, Plan } from '@/lib/types';

export default function DashboardPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    let timer: any;
    const load = async () => {
      try {
        const [s, d, n] = await Promise.all([
          api<{ subscription: Subscription | null; plan: Plan | null }>('/api/subscriptions/me'),
          api<{ devices: Device[] }>('/api/devices'),
          api<{ notifications: Notification[] }>('/api/notifications'),
        ]);
        setSub(s.subscription); setPlan(s.plan);
        setDevices(d.devices);
        setNotifs(n.notifications.slice(0, 5));
      } catch {}
      timer = setTimeout(load, 15000);
    };
    load();
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppShell>
      <section className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Current plan</div>
            <div className="text-lg font-semibold capitalize">
              {sub?.plan_name || 'No plan'}
            </div>
          </div>
          <div>
            {sub && sub.isActive ? (
              <span className="badge-green">{sub.daysRemaining} days left</span>
            ) : (
              <span className="badge-red">Inactive</span>
            )}
          </div>
        </div>
        {!sub?.isActive && (
          <Link href="/subscription" className="btn-primary mt-3 inline-flex">
            Activate a plan
          </Link>
        )}
      </section>

      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Your devices</h2>
          <Link href="/devices" className="text-sm text-brand-700">Manage →</Link>
        </div>
        {devices.length === 0 && (
          <div className="card text-sm text-gray-500">
            No devices yet. <Link href="/devices" className="text-brand-700">Add one</Link>.
          </div>
        )}
        <div className="grid gap-2">
          {devices.map((d) => (
            <Link key={d.id} href={`/device/${d.id}`} className="card flex items-center justify-between">
              <div>
                <div className="font-medium">{d.device_name}</div>
                <div className="text-xs text-gray-500">{d.device_uid}</div>
              </div>
              <span className={d.status === 'online' ? 'badge-green' : 'badge-gray'}>
                {d.status}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-semibold mb-2">Recent alerts</h2>
        {notifs.length === 0 && <div className="card text-sm text-gray-500">No alerts.</div>}
        <div className="grid gap-2">
          {notifs.map((n) => (
            <div key={n.id} className="card">
              <div className="text-sm font-medium">{n.title}</div>
              <div className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</div>
              <div className="text-sm text-gray-700 mt-1">{n.message}</div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
