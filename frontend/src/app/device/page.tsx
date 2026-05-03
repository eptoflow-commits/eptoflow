'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

function DeviceContent({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<Detail>(`/api/devices/${id}`);
      setData(d);
      setErr(null);
    } catch (e: any) {
      setErr(e.message || 'Failed to load device');
    }
  }, [id]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  if (err) return (
    <AppShell>
      <div className="card text-red-600 text-sm">⚠️ {err}</div>
    </AppShell>
  );

  if (!data) return (
    <AppShell>
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-400 text-sm">Loading device…</div>
      </div>
    </AppShell>
  );

  const { device, last_status, recent_commands, plan } = data;
  if (!plan) return (
    <AppShell>
      <div className="card text-red-600 text-sm">⚠️ Device plan not configured.</div>
    </AppShell>
  );

  const isOnline = device.status === 'online';
  const moisture = last_status?.moisture_value ?? null;
  const outputs = plan.allowedOutputs ?? [];
  const valveState = (key: string) => last_status?.[`${key}_state`];

  const send = async (command_type: string, payload: Record<string, any> = {}) => {
    try {
      await api(`/api/devices/${id}/commands`, {
        method: 'POST',
        body: JSON.stringify({ command_type, payload, source: 'manual' }),
      });
      load();
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{device.device_name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{device.device_uid} · {plan.plan} plan</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {isOnline ? '● Online' : '○ Offline'}
        </span>
      </div>

      {/* Moisture */}
      {plan.hasMoisture && (
        <div className="bg-gradient-to-r from-blue-50 to-brand-50 rounded-xl border border-blue-100 p-4 mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Soil Moisture</div>
          <div className="text-3xl font-bold text-brand-700">
            {moisture == null ? '—' : `${moisture}%`}
          </div>
          {moisture != null && (
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div className="bg-brand-500 rounded-full h-2 transition-all"
                   style={{ width: `${moisture}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Valve controls */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {outputs.filter((o: string) => o.startsWith('valve')).map((v: string) => (
          <div key={v} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-800 capitalize text-sm">{v.replace('valve', 'Valve ')}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                valveState(v) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{valveState(v) ? 'ON' : 'OFF'}</span>
            </div>
            <div className="flex gap-1.5 mb-1.5">
              <button className="btn-primary flex-1 text-xs py-1.5"
                      onClick={() => send('valve_on', { target: v })}
                      disabled={!isOnline}>On</button>
              <button className="btn-secondary flex-1 text-xs py-1.5"
                      onClick={() => send('valve_off', { target: v })}
                      disabled={!isOnline}>Off</button>
            </div>
            <button className="btn-secondary w-full text-xs py-1.5"
                    onClick={() => send('water_for', { target: v, duration: 120 })}
                    disabled={!isOnline}>
              ⏱ 2 min
            </button>
          </div>
        ))}

        {outputs.includes('relay1') && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-800 text-sm">Motor / Light</div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                last_status?.relay1_state ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{last_status?.relay1_state ? 'ON' : 'OFF'}</span>
            </div>
            <div className="flex gap-1.5">
              <button className="btn-primary flex-1 text-xs py-1.5"
                      onClick={() => send('relay_on')} disabled={!isOnline}>On</button>
              <button className="btn-secondary flex-1 text-xs py-1.5"
                      onClick={() => send('relay_off')} disabled={!isOnline}>Off</button>
            </div>
          </div>
        )}
      </div>

      {/* Stop all */}
      <div className="mb-4">
        <button className="btn-danger w-full py-2.5 text-sm font-semibold"
                onClick={() => send('stop_all')} disabled={!isOnline}>
          ■ Stop everything
        </button>
      </div>

      {/* Voice */}
      {plan.hasVoice && (
        <div className="mb-4">
          <VoiceButton deviceId={device.id} disabled={!isOnline} onCommand={load} />
        </div>
      )}

      {/* Recent commands */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-2">Recent commands</h2>
        <div className="space-y-2">
          {recent_commands.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-900">{c.command_type}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.status === 'executed' ? 'bg-green-100 text-green-700' :
                  c.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>{c.status}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(c.created_at).toLocaleString('en-IN')} · {c.source}
              </div>
            </div>
          ))}
          {recent_commands.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-400">
              No commands yet.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function DevicePageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');

  useEffect(() => {
    if (!id) router.replace('/devices');
  }, [id, router]);

  if (!id) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Redirecting…</div>
    </div>
  );

  return <DeviceContent id={id} />;
}

export default function DevicePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
      </div>
    }>
      <DevicePageInner />
    </Suspense>
  );
}
