'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const load = async () => {
    const { users } = await api<{ users: any[] }>('/api/admin/users', { auth: 'admin' });
    setUsers(users);
  };
  useEffect(() => { load(); }, []);
  const toggle = async (u: any) => {
    const next = u.status === 'active' ? 'suspended' : 'active';
    await api(`/api/admin/users/${u.id}/status`, { method: 'POST', auth: 'admin', body: JSON.stringify({ status: next }) });
    load();
  };
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-100 rounded">
        <thead className="text-xs text-gray-500"><tr>
          <th className="p-2 text-left">Email</th><th className="p-2 text-left">Name</th>
          <th className="p-2 text-left">Plan</th><th className="p-2 text-left">Status</th><th />
        </tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t text-sm">
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.full_name}</td>
              <td className="p-2">{u.plan_name || '—'} {u.sub_status ? `(${u.sub_status})` : ''}</td>
              <td className="p-2">
                <span className={u.status === 'active' ? 'badge-green' : 'badge-red'}>{u.status}</span>
              </td>
              <td className="p-2"><button className="btn-secondary" onClick={() => toggle(u)}>
                {u.status === 'active' ? 'Suspend' : 'Reactivate'}
              </button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
