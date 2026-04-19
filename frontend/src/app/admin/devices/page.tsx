'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const load = async () => {
    const { devices } = await api<{ devices: any[] }>('/api/admin/devices', { auth: 'admin' });
    setDevices(devices);
  };
  useEffect(() => { load(); }, []);
  const toggle = async (d: any) => {
    await api(`/api/admin/devices/${d.id}/enabled`, {
      method: 'POST', auth: 'admin', body: JSON.stringify({ enabled: !d.enabled }),
    });
    load();
  };
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-100 rounded">
        <thead className="text-xs text-gray-500"><tr>
          <th className="p-2 text-left">UID</th><th className="p-2 text-left">User</th>
          <th className="p-2 text-left">Plan</th><th className="p-2 text-left">Status</th>
          <th className="p-2 text-left">Enabled</th><th />
        </tr></thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.id} className="border-t text-sm">
              <td className="p-2 font-mono">{d.device_uid}</td>
              <td className="p-2">{d.user_email || '—'}</td>
              <td className="p-2">{d.plan_bound}</td>
              <td className="p-2"><span className={d.status === 'online' ? 'badge-green' : 'badge-gray'}>{d.status}</span></td>
              <td className="p-2">{d.enabled ? 'yes' : 'no'}</td>
              <td className="p-2"><button className="btn-secondary" onClick={() => toggle(d)}>
                {d.enabled ? 'Disable' : 'Enable'}
              </button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
