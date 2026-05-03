'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Device, Subscription, Notification, Plan } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
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
        setSub(s.subscription);
        setDevices(d.devices);
        setNotifs(n.notifications.slice(0, 3));
      } catch {}
      timer = setTimeout(load, 15000);
    };
    load();
    return () => clearTimeout(timer);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <AppShell>
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{greeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋</h1>
        <p className="text-sm text-gray-500">Here's what's happening with your garden</p>
      </div>

      {/* Subscription card */}
      <section className="mb-4">
        {sub?.isActive ? (
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-brand-100 uppercase tracking-wide font-medium">Active Plan</div>
                <div className="text-2xl font-bold capitalize mt-0.5">{sub.plan_name}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{sub.daysRemaining}</div>
                <div className="text-xs text-brand-100">days left</div>
              </div>
            </div>
            <div className="mt-3 bg-white/20 rounded-full h-1.5">
              <div
                className="bg-white rounded-full h-1.5 transition-all"
                style={{ width: `${Math.min(100, (sub.daysRemaining / 30) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <div className="font-semibold text-amber-900">No active plan</div>
                <div className="text-xs text-amber-700">Activate a plan to start automating</div>
              </div>
              <Link href="/subscription" className="ml-auto btn-primary text-xs">Activate →</Link>
            </div>
          </div>
        )}
      </section>

      {/* Devices */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800">Your devices</h2>
          <Link href="/devices" className="text-xs text-brand-600 font-medium">View all →</Link>
        </div>
        {devices.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
            <div className="text-3xl mb-2">📡</div>
            <div className="text-sm text-gray-500">No devices assigned yet.</div>
            <div className="text-xs text-gray-400 mt-1">Contact your admin to add a device</div>
          </div>
        ) : (
          <div className="grid gap-2">
            {devices.map((d) => (
              <Link key={d.id} href={`/device/${d.id}`}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 hover:border-brand-200 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  d.status === 'online' ? 'bg-brand-50' : 'bg-gray-100'
                }`}>💧</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{d.device_name}</div>
                  <div className="text-xs text-gray-400">{d.device_uid}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  d.status === 'online'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {d.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Notifications */}
      {notifs.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-800 mb-2">Recent alerts</h2>
          <div className="space-y-2">
            {notifs.map((n) => (
              <div key={n.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <div className="flex gap-2">
                  <span className="text-lg">🔔</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{n.message}</div>
                    <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
