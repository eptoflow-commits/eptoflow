'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Device } from '@/lib/types';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState<{ device_uid: string; device_secret: string } | null>(null);

  const load = async () => {
    const { devices } = await api<{ devices: Device[] }>('/api/devices');
    setDevices(devices);
  };
  useEffect(() => { load(); }, []);

  const provision = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await api<{
        device: Device;
        provisioning: { device_uid: string; device_secret: string };
      }>('/api/devices', { method: 'POST', body: JSON.stringify({}) });
      setNewDevice(res.provisioning);
      load();
    } catch (e: any) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this device?')) return;
    await api(`/api/devices/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Devices</h1>
        <button className="btn-primary" disabled={busy} onClick={provision}>
          {busy ? 'Adding…' : '+ Add device'}
        </button>
      </div>
      {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
      {newDevice && (
        <div className="card mb-4 border-brand-200">
          <div className="font-semibold text-brand-700 mb-2">New device credentials</div>
          <p className="text-sm text-gray-700 mb-2">
            Copy these credentials into your device configuration. They are shown only once — store them safely.
          </p>
          <div className="bg-gray-50 text-xs p-3 rounded border space-y-1">
            <div><span className="text-gray-500 select-none">Device UID: </span><code className="font-semibold text-gray-800">{newDevice.device_uid}</code></div>
            <div><span className="text-gray-500 select-none">Device Secret: </span><code className="font-semibold text-gray-800">{newDevice.device_secret}</code></div>
          </div>
          <button className="btn-secondary mt-3" onClick={() => setNewDevice(null)}>
            I saved the secret
          </button>
        </div>
      )}
      <div className="grid gap-2">
        {devices.map((d) => (
          <div key={d.id} className="card flex items-center justify-between">
            <Link href={`/device?id=${d.id}`} className="flex-1">
              <div className="font-medium">{d.device_name}</div>
              <div className="text-xs text-gray-500">{d.device_uid} · {d.plan_bound}</div>
            </Link>
            <span className={d.status === 'online' ? 'badge-green' : 'badge-gray'}>{d.status}</span>
            <button onClick={() => remove(d.id)} className="text-red-600 text-sm ml-3">Remove</button>
          </div>
        ))}
        {devices.length === 0 && (
          <div className="card text-sm text-gray-500">
            No devices yet. Click “Add device” to provision one.
          </div>
        )}
      </div>
    </AppShell>
  );
}
