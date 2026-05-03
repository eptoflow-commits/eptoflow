'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import VoiceButton from '@/components/VoiceButton';
import { api } from '@/lib/api';
import type { Command, Device, Plan } from '@/lib/types';

type Detail = { device: Device; last_status: any; recent_commands: Command[]; plan: Plan };

/* ── Animated toggle ─────────────────────────────────────────────── */
function Toggle({ on, loading, disabled, onToggle }: {
  on: boolean; loading?: boolean; disabled?: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} disabled={disabled || loading} aria-pressed={on} style={{
      position: 'relative', width: 58, height: 32, borderRadius: 16, border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: on ? 'linear-gradient(135deg,#10b981,#059669)' : '#d1d5db',
      boxShadow: on ? '0 0 14px rgba(16,185,129,0.5),inset 0 1px 2px rgba(0,0,0,0.1)' : 'inset 0 2px 4px rgba(0,0,0,0.15)',
      transition: 'background 0.25s, box-shadow 0.25s',
      opacity: disabled ? 0.4 : 1, flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 4, left: on ? 30 : 4,
        width: 24, height: 24, borderRadius: '50%',
        background: loading ? 'transparent' : '#fff',
        border: loading ? '2.5px solid rgba(255,255,255,0.6)' : 'none',
        borderTopColor: loading ? 'transparent' : undefined,
        boxShadow: loading ? 'none' : '0 2px 6px rgba(0,0,0,0.25)',
        transition: 'left 0.25s cubic-bezier(.34,1.4,.64,1)',
        animation: loading ? 'spin 0.6s linear infinite' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11,
      }}>
        {!loading && (on ? '💧' : '')}
      </span>
    </button>
  );
}

/* ── Output card ─────────────────────────────────────────────────── */
function OutputCard({ label, icon, isOn, loading, isOnline, onToggle, onTimed }: {
  label: string; icon: string; isOn: boolean; loading: boolean;
  isOnline: boolean; onToggle: () => void; onTimed?: () => void;
}) {
  return (
    <div style={{
      background: isOn ? 'linear-gradient(145deg,#ecfdf5,#d1fae5)' : '#fff',
      borderRadius: 18, padding: '14px 16px',
      border: `1.5px solid ${isOn ? '#6ee7b7' : '#e5e7eb'}`,
      boxShadow: isOn ? '0 6px 24px rgba(16,185,129,0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
      transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden',
    }}>
      {/* Active pulse ring */}
      {isOn && !loading && (
        <span style={{
          position: 'absolute', top: 10, right: 10, width: 9, height: 9,
          borderRadius: '50%', background: '#10b981',
          animation: 'pulseRing 1.8s ease-out infinite',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: onTimed ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: isOn ? 'rgba(16,185,129,0.15)' : '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, transition: 'all 0.3s',
            filter: isOn ? 'none' : 'grayscale(0.6)',
          }}>{icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: isOn ? '#065f46' : '#1f2937' }}>
              {label}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              color: isOn ? '#059669' : '#9ca3af', textTransform: 'uppercase',
              marginTop: 1,
            }}>
              {loading ? 'Updating…' : isOn ? 'Running' : 'Idle'}
            </div>
          </div>
        </div>
        <Toggle on={isOn} loading={loading} disabled={!isOnline} onToggle={onToggle} />
      </div>
      {onTimed && (
        <button onClick={onTimed} disabled={!isOnline || loading} style={{
          width: '100%', padding: '8px 0', borderRadius: 10,
          border: `1.5px solid ${isOn ? '#a7f3d0' : '#e5e7eb'}`,
          background: isOn ? 'rgba(255,255,255,0.55)' : '#f9fafb',
          color: isOn ? '#065f46' : '#6b7280',
          fontSize: 12, fontWeight: 700, cursor: !isOnline ? 'not-allowed' : 'pointer',
          opacity: !isOnline || loading ? 0.5 : 1, transition: 'all 0.2s',
          letterSpacing: '0.02em',
        }}>
          ⏱ 2 min run
        </button>
      )}
    </div>
  );
}

/* ── Device content ──────────────────────────────────────────────── */
function DeviceContent({ id }: { id: string }) {
  const [data, setData]             = useState<Detail | null>(null);
  const [err, setErr]               = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<Detail>(`/api/devices/${id}`);
      setData(d);
      setErr(null);
      // Only clear optimistic keys where server has caught up to our prediction.
      // This prevents the poll from reverting the switch before the relay fires.
      setOptimistic(prev => {
        if (!Object.keys(prev).length) return prev;
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          const serverVal = !!d.last_status?.[`${key}_state`];
          if (serverVal === next[key]) delete next[key]; // confirmed — remove
        }
        return next;
      });
    } catch (e: any) { setErr(e.message || 'Failed to load device'); }
  }, [id]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 2000); // poll every 2 s for snappier feedback
    return () => clearInterval(timerRef.current);
  }, [load]);

  if (err) return <AppShell><div className="card text-red-600 text-sm">⚠️ {err}</div></AppShell>;
  if (!data) return (
    <AppShell>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'64px 0' }}>
        <div style={{ color:'#9ca3af', fontSize:14 }}>Loading device…</div>
      </div>
    </AppShell>
  );

  const { device, last_status, recent_commands, plan } = data;
  if (!plan) return <AppShell><div className="card text-red-600 text-sm">⚠️ Device plan not configured.</div></AppShell>;

  const isOnline = device.status === 'online';
  const moisture = last_status?.moisture_value ?? null;
  const outputs: string[] = plan.allowedOutputs ?? [];

  // Use optimistic state for immediate feedback, fall back to server state
  const isOn = (key: string) =>
    key in optimistic ? optimistic[key] : !!last_status?.[`${key}_state`];

  const send = async (command_type: string, payload: Record<string, any> = {}) => {
    const key = payload.target || 'relay1';
    setLoadingKey(key);
    try {
      await api(`/api/devices/${id}/commands`, {
        method: 'POST',
        body: JSON.stringify({ command_type, payload, source: 'manual' }),
      });
      await load();
    } catch (e: any) {
      setErr(e.message);
      // revert optimistic on failure
      setOptimistic(s => { const n = { ...s }; delete n[key]; return n; });
    } finally { setLoadingKey(null); }
  };

  const toggle = (key: string) => {
    const next = !isOn(key);
    setOptimistic(s => ({ ...s, [key]: next }));   // instant visual flip
    if (key === 'relay1') {
      send(next ? 'relay_on' : 'relay_off');
    } else {
      send(next ? 'valve_on' : 'valve_off', { target: key });
    }
  };

  const valves = outputs.filter((o: string) => o.startsWith('valve'));
  const hasRelay = outputs.includes('relay1');
  const valveIcons = ['💧', '🚿', '🌊'];

  return (
    <AppShell>
      <style>{`
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.6); }
          70%  { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#064e3b 0%,#065f46 60%,#047857 100%)',
        borderRadius: 20, padding: '18px 20px', marginBottom: 20, color: '#fff',
        boxShadow: '0 8px 28px rgba(6,78,59,0.4)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{device.device_name}</div>
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{device.device_uid}</div>
            <div style={{
              display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(255,255,255,0.15)', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{plan.plan} plan</div>
          </div>
          <div style={{
            display:'flex', alignItems:'center', gap: 6, padding:'6px 12px', borderRadius: 20,
            background: isOnline ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${isOnline ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.2)'}`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
              background: isOnline ? '#34d399' : '#6b7280',
              boxShadow: isOnline ? '0 0 8px #34d399' : 'none',
              animation: isOnline ? 'pulseRing 2s infinite' : 'none',
            }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* ── Moisture ── */}
      {plan.hasMoisture && (
        <div style={{
          background:'linear-gradient(135deg,#eff6ff,#dbeafe)', borderRadius:16,
          border:'1.5px solid #bfdbfe', padding:'14px 18px', marginBottom:16,
          boxShadow:'0 2px 12px rgba(59,130,246,0.1)', animation:'fadeIn 0.4s ease',
        }}>
          <div style={{ fontSize:11, color:'#3b82f6', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
            🌱 Soil Moisture
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ fontSize:38, fontWeight:900, color:'#1d4ed8', lineHeight:1 }}>
              {moisture == null ? '—' : `${moisture}%`}
            </div>
            {moisture != null && (
              <div style={{ flex:1 }}>
                <div style={{ height:10, background:'#bfdbfe', borderRadius:6, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', width:`${moisture}%`, borderRadius:6,
                    background:'linear-gradient(90deg,#3b82f6,#60a5fa)',
                    boxShadow:'0 0 8px rgba(59,130,246,0.4)', transition:'width 1s ease',
                  }}/>
                </div>
                <div style={{ fontSize:11, color:'#60a5fa', marginTop:4 }}>
                  {moisture<30 ? '🔴 Dry — needs water' : moisture<65 ? '🟡 Moderate' : '🟢 Well watered'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:10 }}>Output Controls</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        {valves.map((v, i) => (
          <OutputCard
            key={v} label={`Valve ${v.replace('valve','')}`}
            icon={valveIcons[i] || '💧'} isOn={isOn(v)}
            loading={loadingKey === v} isOnline={isOnline}
            onToggle={() => toggle(v)}
            onTimed={() => {
              setOptimistic(s => ({ ...s, [v]: true }));
              send('water_for', { target: v, duration: 120 });
            }}
          />
        ))}
        {hasRelay && (
          <OutputCard
            label="Motor / Relay" icon="⚡"
            isOn={isOn('relay1')} loading={loadingKey === 'relay1'}
            isOnline={isOnline} onToggle={() => toggle('relay1')}
          />
        )}
      </div>

      {/* ── Stop all ── */}
      <button onClick={() => {
        setOptimistic({});
        send('stop_all');
      }} disabled={!isOnline} style={{
        width:'100%', padding:'14px 0', borderRadius:14, border:'none',
        background: isOnline ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : '#e5e7eb',
        color: isOnline ? '#fff' : '#9ca3af', fontSize:14, fontWeight:800,
        cursor: isOnline ? 'pointer' : 'not-allowed',
        boxShadow: isOnline ? '0 4px 18px rgba(220,38,38,0.35)' : 'none',
        transition:'all 0.2s', marginBottom:16,
      }}>
        ■ Stop Everything
      </button>

      {/* ── Voice ── */}
      {plan.hasVoice && (
        <div style={{ marginBottom:16 }}>
          <VoiceButton deviceId={device.id} disabled={!isOnline} onCommand={load} />
        </div>
      )}

      {/* ── Recent commands ── */}
      <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:10 }}>Recent Commands</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {recent_commands.length === 0 ? (
          <div style={{ background:'#f9fafb', borderRadius:12, padding:16, textAlign:'center', fontSize:13, color:'#9ca3af' }}>
            No commands yet.
          </div>
        ) : recent_commands.map((c) => {
          const ok = c.status === 'executed', fail = c.status === 'failed';
          return (
            <div key={c.id} style={{
              background:'#fff', borderRadius:12, border:'1px solid #f3f4f6',
              padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
              boxShadow:'0 1px 4px rgba(0,0,0,0.05)', animation:'fadeIn 0.3s ease',
            }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:'#111827' }}>{c.command_type}</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                  {new Date(c.created_at).toLocaleString('en-IN')} · {c.source}
                </div>
              </div>
              <span style={{
                padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                background: ok?'#d1fae5':fail?'#fee2e2':'#f3f4f6',
                color: ok?'#065f46':fail?'#991b1b':'#6b7280',
              }}>{c.status}</span>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function DevicePageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');
  useEffect(() => { if (!id) router.replace('/devices'); }, [id, router]);
  if (!id) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#6b7280', fontSize:14 }}>Redirecting…</div></div>;
  return <DeviceContent id={id} />;
}

export default function DevicePage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:'#6b7280', fontSize:14 }}>Loading…</div></div>}>
      <DevicePageInner />
    </Suspense>
  );
}
