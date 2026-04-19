'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminSubsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const load = async () => {
    const r = await api<{ subscriptions: any[] }>('/api/admin/subscriptions', { auth: 'admin' });
    setSubs(r.subscriptions);
  };
  useEffect(() => { load(); }, []);

  const renew = async (s: any) => {
    if (!confirm(`Renew ${s.plan_name} for ${s.email}?`)) return;
    await api('/api/admin/subscriptions/renew', {
      method: 'POST', auth: 'admin',
      body: JSON.stringify({ user_id: s.user_id, plan: s.plan_name, subscription_id: s.id }),
    });
    load();
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-100 rounded">
        <thead className="text-xs text-gray-500"><tr>
          <th className="p-2 text-left">User</th><th className="p-2 text-left">Plan</th>
          <th className="p-2 text-left">Start</th><th className="p-2 text-left">End</th>
          <th className="p-2 text-left">Status</th><th />
        </tr></thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id} className="border-t text-sm">
              <td className="p-2">{s.email}</td>
              <td className="p-2 capitalize">{s.plan_name}</td>
              <td className="p-2">{new Date(s.start_date).toLocaleDateString()}</td>
              <td className="p-2">{new Date(s.end_date).toLocaleDateString()}</td>
              <td className="p-2">
                <span className={s.status === 'active' ? 'badge-green' : 'badge-gray'}>{s.status}</span>
              </td>
              <td className="p-2"><button className="btn-primary" onClick={() => renew(s)}>Renew +30d</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
