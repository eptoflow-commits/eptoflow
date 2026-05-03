'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ user_id: '', plan_bound: 'basic', device_name: '' });
  const [newCreds, setNewCreds] = useState<{ device_uid: string; device_secret: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const [d, u] = await Promise.all([
      api<{ devices: any[] }>('/api/admin/devices', { auth: 'admin' }),
      api<{ users: any[] }>('/api/admin/users', { auth: 'admin' }),
    ]);
    setDevices(d.devices);
    setUsers(u.users);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (d: any) => {
    await api(`/api/admin/devices/${d.id}/enabled`, {
      method: 'POST', auth: 'admin', body: JSON.stringify({ enabled: !d.enabled }),
    });
    load();
  };

  const remove = async (d: any) => {
    if (!confirm(`Delete device ${d.device_uid}? This cannot be undone.`)) return;
    await api(`/api/admin/devices/${d.id}`, { method: 'DELETE', auth: 'admin' });
    load();
  };

  const provision = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await api<{ device: any; provisioning: any }>('/api/admin/devices/provision', {
        method: 'POST', auth: 'admin', body: JSON.stringify(form),
      });
      setNewCreds(r.provisioning);
      setShowForm(false);
      setForm({ user_id: '', plan_bound: 'basic', device_name: '' });
      load();
    } catch (e: any) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Devices ({devices.length})</h2>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setErr(null); setNewCreds(null); }}>
          {showForm ? '✕ Cancel' : '+ Add device for user'}
        </button>
      </div>

      {newCreds && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="font-semibold text-amber-900">📋 New device credentials — save these now</div>
          <p className="text-xs text-amber-700">These are shown only once. Share with the user securely.</p>
          <div className="bg-white rounded-lg border border-amber-200 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Device UID</span>
              <code className="text-sm font-semibold text-gray-900">{newCreds.device_uid}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Device Secret</span>
              <code className="text-xs font-semibold text-gray-900 break-all">{newCreds.device_secret}</code>
            </div>
          </div>
          <button className="btn-secondary text-xs" onClick={() => setNewCreds(null)}>I've saved the credentials ✓</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={provision} className="bg-white border border-brand-100 rounded-xl p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-gray-900">Provision device for user</h3>
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">⚠️ {err}</div>}
          <div>
            <label className="label">Assign to user</label>
            <select className="input" required value={form.user_id}
                    onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
              <option value="">Select a user…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Plan</label>
              <select className="input" value={form.plan_bound}
                      onChange={e => setForm(f => ({ ...f, plan_bound: e.target.value }))}>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="label">Device name (optional)</label>
              <input className="input" placeholder="e.g. Garden Valve"
                     value={form.device_name}
                     onChange={e => setForm(f => ({ ...f, device_name: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? 'Provisioning…' : 'Provision device'}</button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Device UID</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {devices.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{d.device_uid}</td>
                <td className="px-3 py-2.5 text-gray-600">{d.user_name || d.user_email || <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    d.plan_bound === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>{d.plan_bound}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    d.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>{d.status}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggle(d)}
                            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      {d.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => remove(d)}
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">No devices yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
