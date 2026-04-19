'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import VoiceButton from '@/components/VoiceButton';
import { api } from '@/lib/api';
import type { Command, Device, Plan } from '@/lib/types';

type Detail = {
  device: Device;
  last_status: any;
  recent_commands: Command[];
  plan: Plan;
};

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<Detail>(`/api/devices/${id}`);
      setData(d);
      setErr(null);
    } catch (e: any) { setErr(e.message); }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (command_type: string, payload: Record<string, any> = {}) => {
    try {
      await api(`/api/devices/${id}/commands`, {
        method: 'POST',
        body: JSON.stringify({ command_type, payload, source: 'manual' }),
      });
      load();
    } catch (e: any) { setErr(e.message); }
  };

  if (err) return <AppShell><div className="text-red-600">{err}</div></AppShell>;
  if (!data) return <AppShell><div className="text-gray-500">Loading…</div></AppShell>;

  const { device, last_status, recent_commands, plan } = data;
  const isOnline = device.status === 'online';
  const moisture = last_status?.moisture_value ?? null;

  const outputs = plan.allowedOutputs;
  const valveState = (key: string) => last_status?.[`${key}_state`];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold">{device.device_name}</h1>
          <p className="text-xs text-gray-500">{device.device_uid} · {plan.plan}</p>
        </div>
        <span className={isOnline ? 'badge-green' : 'badge-gray'}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {plan.hasMoisture && (
        <div className="card mb-3">
          <div className="text-sm text-gray-500">Moisture</div>
          <div className="text-2xl font-semibold">
            {moisture == null ? '—' : `${moisture}%`}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        {outputs.filter((o) => o.startsWith('valve')).map((v) => (
          <div key={v} className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium capitalize">{v}</div>
              <span className={valveState(v) ? 'badge-green' : 'badge-gray'}>
                {valveState(v) ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1"
                      onClick={() => send('valve_on', { target: v })}
                      disabled={!isOnline}>On</button>
              <button className="btn-secondary flex-1"
                      onClick={() => send('valve_off', { target: v })}
                      disabled={!isOnline}>Off</button>
            </div>
            <button className="btn-secondary mt-2 w-full text-xs"
                    onClick={() => send('water_for', { target: v, duration: 120 })}
                    disabled={!isOnline}>
              Water for 2 min
            </button>
          </div>
        ))}

        {outputs.includes('relay1') && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Motor / Light</div>
              <span className={last_status?.relay1_state ? 'badge-green' : 'badge-gray'}>
                {last_status?.relay1_state ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1"
                      onClick={() => send('relay_on')} disabled={!isOnline}>On</button>
              <button className="btn-secondary flex-1"
                      onClick={() => send('relay_off')} disabled={!isOnline}>Off</button>
            </div>
          </div>
        )}
      </div>

      <div className="card mb-4">
        <button className="btn-danger w-full" onClick={() => send('stop_all')} disabled={!isOnline}>
          ■ Stop everything
        </button>
      </div>

      {plan.hasVoice && (
        <div className="mb-4">
          <VoiceButton deviceId={device.id} disabled={!isOnline} onCommand={load} />
        </div>
      )}

      <section>
        <h2 className="font-semibold mb-2">Recent commands</h2>
        <div className="grid gap-2">
          {recent_commands.map((c) => (
            <div key={c.id} className="card text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.command_type}</span>
                <span className={
                  c.status === 'executed' ? 'badge-green' :
                  c.status === 'failed' ? 'badge-red' : 'badge-gray'
                }>{c.status}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(c.created_at).toLocaleString()} · source: {c.source}
              </div>
              {c.payload?.target && <div className="text-xs">target: {c.payload.target}{c.payload.duration ? `, duration: ${c.payload.duration}s` : ''}</div>}
            </div>
          ))}
          {recent_commands.length === 0 && <div className="card text-sm text-gray-500">No commands yet.</div>}
        </div>
      </section>
    </AppShell>
  );
}
