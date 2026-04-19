'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);

  const load = async () => {
    const r = await api<{ notifications: Notification[] }>('/api/notifications');
    setItems(r.notifications);
  };
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api('/api/notifications/read-all', { method: 'POST' });
    load();
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Alerts</h1>
        <button className="btn-secondary" onClick={markAll}>Mark all read</button>
      </div>
      <div className="grid gap-2">
        {items.map((n) => (
          <div key={n.id} className={`card ${n.is_read ? 'opacity-70' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{n.title}</div>
              <span className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm text-gray-700 mt-1">{n.message}</div>
            <div className="text-xs text-gray-400 mt-1">{n.type}</div>
          </div>
        ))}
        {items.length === 0 && <div className="card text-sm text-gray-500">No notifications.</div>}
      </div>
    </AppShell>
  );
}
