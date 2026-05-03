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

/* ─── Animated Toggle Switch ─────────────────────────────────────── */
function Toggle({
  on, disabled, onToggle,
}: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      style={{
        position: 'relative',
        width: 56,
        height: 30,
        borderRadius: 15,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: on
          ? 'linear-gradient(135deg, #10b981, #059669)'
          : '#d1d5db',
        boxShadow: on
          ? '0 0 12px rgba(16,185,129,0.45), inset 0 1px 2px rgba(0,0,0,0.15)'
          : 'inset 0 1px 2px rgba(0,0,0,0.2)',
        transition: 'background 0.3s, box-shadow 0.3s',
        opacity: disabled ? 0.45 : 1,
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: on ? 29 : 3,
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        transition: 'left 0.28s cubic-bezier(.34,1.56,.64,1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
      }}>
        {on ? '💧' : ''}
      </span>
    </button>
  );
}

/* ─── Output Card ─────────────────────────────────────────────────── */
function OutputCard({
  label, icon, isOn, isOnline, onToggle, onTimed, timedLabel,
}: {
  label: string; icon: string; isOn: boolean; isOnline: boolean;
  onToggle: () => void; onTimed?: () => void; timedLabel?: string;
}) {
  const [ripple, setRipple] = useState(false);

  const handleToggle = () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
    onToggle();
  };

  return (
    <div style={{
      background: isOn
        ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
        : '#fff',
      borderRadius: 16,
      border: `1.5px solid ${isOn ? '#6ee7b7' : '#e5e7eb'}`,
      boxShadow: isOn
        ? '0 4px 20px rgba(16,185,129,0.18)'
        : '0 2px 8px rgba(0,0,0,0.06)',
      padding: '14px 16px',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ripple */}
      {ripple && (
        <span style={{
          position: 'absolute',
          inset: 0,
          background: isOn
            ? 'rgba(16,185,129,0.12)'
            : 'rgba(0,0,0,0.04)',
          borderRadius: 16,
          animation: 'rippleFade 0.6s ease-out forwards',
        }} />
      )}

      {/* Pulse ring when ON */}
      {isOn && (
        <span style={{
          position: 'absolute',
          top: 12, right: 12,
          width: 10, height: 10,
          borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 0 0 rgba(16,185,129,0.5)',
          animation: 'pulse 1.8s ease-out infinite',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 22,
            filter: isOn ? 'none' : 'grayscale(1)',
            transition: 'filter 0.3s',
          }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: isOn ? '#065f46' : '#374151' }}>
              {label}
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: isOn ? '#059669' : '#9ca3af',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {isOn ? 'Active' : 'Idle'}
            </div>
          </div>
        </div>
        <Toggle on={isOn} disabled={!isOnline} onToggle={handleToggle} />
      </div>

      {onTimed && (
        <button
          onClick={onTimed}
          disabled={!isOnline}
          style={{
            width: '100%',
            padding: '7px 0',
            borderRadius: 10,
            border: `1.5px solid ${isOn ? '#a7f3d0' : '#e5e7eb'}`,
            background: isOn ? 'rgba(255,255,255,0.6)' : '#f9fafb',
            color: isOn ? '#065f46' : '#6b7280',
            fontSize: 12,
            fontWeight: 600,
            cursor: !isOnline ? 'not-allowed' : 'pointer',
            opacity: !isOnline ? 0.45 : 1,
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
          }}
        >
          ⏱ {timedLabel || '2 min run'}
        </button>
      )}
    </div>
  );
}

/* ─── Main device content ─────────────────────────────────────────── */
function DeviceContent({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
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
  const outputs: string[] = plan.allowedOutputs ?? [];

  const valveOn = (key: string) => !!last_status?.[`${key}_state`];

  const send = async (command_type: string, payload: Record<string, any> = {}) => {
    const key = command_type + (payload.target || '');
    setSending(key);
    try {
      await api(`/api/devices/${id}/commands`, {
        method: 'POST',
        body: JSON.stringify({ command_type, payload, source: 'manual' }),
      });
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setSending(null); }
  };

  const toggleValve = (v: string) =>
    valveOn(v) ? send('valve_off', { target: v }) : send('valve_on', { target: v });

  const toggleRelay = () =>
    last_status?.relay1_state ? send('relay_off') : send('relay_on');

  const valves = outputs.filter((o: string) => o.startsWith('valve'));
  const hasRelay = outputs.includes('relay1');

  return (
    <AppShell>
      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
          70%  { box-shadow: 0 0 0 9px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes rippleFade {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
        borderRadius: 20,
        padding: '18px 20px',
        marginBottom: 20,
        color: '#fff',
        boxShadow: '0 8px 24px rgba(6,78,59,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {device.device_name}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              {device.device_uid}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: 8,
              padding: '3px 10px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.15)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {plan.plan} plan
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 20,
            background: isOnline ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${isOnline ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.2)'}`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isOnline ? '#34d399' : '#9ca3af',
              boxShadow: isOnline ? '0 0 8px #34d399' : 'none',
              animation: isOnline ? 'pulse 2s infinite' : 'none',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Moisture ── */}
      {plan.hasMoisture && (
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderRadius: 16,
          border: '1.5px solid #bfdbfe',
          padding: '14px 18px',
          marginBottom: 16,
          boxShadow: '0 2px 12px rgba(59,130,246,0.1)',
        }}>
          <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            🌱 Soil Moisture
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>
              {moisture == null ? '—' : `${moisture}%`}
            </div>
            {moisture != null && (
              <div style={{ flex: 1 }}>
                <div style={{ height: 10, background: '#bfdbfe', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${moisture}%`,
                    borderRadius: 6,
                    background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                    boxShadow: '0 0 8px rgba(59,130,246,0.4)',
                    transition: 'width 1s ease',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 4 }}>
                  {moisture < 30 ? '🔴 Dry — consider watering' : moisture < 65 ? '🟡 Moderate' : '🟢 Well watered'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Output controls ── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, letterSpacing: '-0.01em' }}>
          Output Controls
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {valves.map((v: string, i: number) => {
            const num = v.replace('valve', '');
            const icons = ['💧', '🚿', '🌊'];
            return (
              <OutputCard
                key={v}
                label={`Valve ${num}`}
                icon={icons[i] || '💧'}
                isOn={valveOn(v)}
                isOnline={isOnline}
                onToggle={() => toggleValve(v)}
                onTimed={() => send('water_for', { target: v, duration: 120 })}
                timedLabel="2 min run"
              />
            );
          })}
          {hasRelay && (
            <OutputCard
              label="Motor / Relay"
              icon="⚡"
              isOn={!!last_status?.relay1_state}
              isOnline={isOnline}
              onToggle={toggleRelay}
            />
          )}
        </div>
      </div>

      {/* ── Stop all ── */}
      <div style={{ marginTop: 14, marginBottom: 16 }}>
        <button
          onClick={() => send('stop_all')}
          disabled={!isOnline}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 14,
            border: 'none',
            background: isOnline
              ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
              : '#e5e7eb',
            color: isOnline ? '#fff' : '#9ca3af',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.02em',
            cursor: isOnline ? 'pointer' : 'not-allowed',
            boxShadow: isOnline ? '0 4px 16px rgba(220,38,38,0.35)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          ■ Stop Everything
        </button>
      </div>

      {/* ── Voice ── */}
      {plan.hasVoice && (
        <div style={{ marginBottom: 16 }}>
          <VoiceButton deviceId={device.id} disabled={!isOnline} onCommand={load} />
        </div>
      )}

      {/* ── Recent commands ── */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
          Recent Commands
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent_commands.length === 0 ? (
            <div style={{
              background: '#f9fafb',
              borderRadius: 12,
              padding: '16px',
              textAlign: 'center',
              fontSize: 13,
              color: '#9ca3af',
            }}>No commands yet.</div>
          ) : recent_commands.map((c) => {
            const ok = c.status === 'executed';
            const fail = c.status === 'failed';
            return (
              <div key={c.id} style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #f3f4f6',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.command_type}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                    {new Date(c.created_at).toLocaleString('en-IN')} · {c.source}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: ok ? '#d1fae5' : fail ? '#fee2e2' : '#f3f4f6',
                  color: ok ? '#065f46' : fail ? '#991b1b' : '#6b7280',
                }}>
                  {c.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

/* ─── Route wrapper ──────────────────────────────────────────────── */
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
