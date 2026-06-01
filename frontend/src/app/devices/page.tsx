'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Device } from '@/lib/types';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);

  const load = async () => {
    const { devices } = await api<{ devices: Device[] }>('/api/devices');
    setDevices(devices);
  };
  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Devices</h1>
      </div>
      <div className="grid gap-2">
        {devices.map((d) => (
          <div key={d.id} className="card flex items-center justify-between">
            <Link href={`/device?id=${d.id}`} className="flex-1">
              <div className="font-medium">{d.device_name}</div>
              <div className="text-xs text-gray-500">{d.device_uid} · {d.plan_bound}</div>
            </Link>
            <span className={d.status === 'online' ? 'badge-green' : 'badge-gray'}>{d.status}</span>
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
