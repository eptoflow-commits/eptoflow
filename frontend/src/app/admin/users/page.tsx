'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setOk(null);
    try {
      const r = await api<{ user: any }>('/api/admin/users/create', {
        method: 'POST', auth: 'admin', body: JSON.stringify(form),
      });
      setOk(`✅ User ${r.user.email} created successfully`);
      setForm({ full_name: '', email: '', phone: '', password: '' });
      setShowForm(false);
      load();
    } catch (e: any) { setErr(e.message || 'Failed to create user'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Users ({users.length})</h2>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setErr(null); setOk(null); }}>
          {showForm ? '✕ Cancel' : '+ Create user'}
        </button>
      </div>

      {ok && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2 text-sm">{ok}</div>}

      {showForm && (
        <form onSubmit={createUser} className="bg-white border border-brand-100 rounded-xl p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-gray-900">Create new user</h3>
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">⚠️ {err}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" required value={form.full_name}
                     onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={form.email}
                     onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" value={form.phone}
                     onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6} value={form.password}
                     onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 font-medium text-gray-900">{u.full_name}</td>
                <td className="px-3 py-2.5 text-gray-600">{u.email}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.plan_name === 'premium' ? 'bg-purple-100 text-purple-700' :
                    u.plan_name ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.plan_name ? u.plan_name : 'No plan'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{u.status}</span>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => toggle(u)}
                    className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                      u.status === 'active'
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}>
                    {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">No users yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
