'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import VoiceButton from '@/components/VoiceButton';
import RelayCard from '@/components/RelayCard';
import SensorGraph from '@/components/SensorGraph';
import AutomationRuleBuilder from '@/components/AutomationRuleBuilder';
import { api } from '@/lib/api';
import type { Command, Device, Plan, Subscription } from '@/lib/types';

type Detail = { device: Device; last_status: any; recent_commands: Command[]; plan: Plan };

// ── Sensor alert sub-component ────────────────────────────────────────────────
type SensorAlert = {
  id: string; alert_type: string; valve_key: string | null;
  threshold: number | null; actual_value: number | null; created_at: string;
};

function SensorAlerts({ deviceId }: { deviceId: string }) {
  const [alerts, setAlerts] = useState<SensorAlert[]>([]);

  useEffect(() => {
    if (!deviceId) return;
    api<{ alerts: SensorAlert[] }>(`/api/sensors/${deviceId}/alerts`)
      .then(r => setAlerts(r.alerts))
      .catch(() => {});
  }, [deviceId]);

  if (alerts.length === 0) return null;

  const alertMeta = (type: string) => {
    if (type === 'moisture_low')   return { icon:'💧', color:'#0284c7', bg:'#e0f2fe', label:'Low moisture' };
    if (type === 'moisture_high')  return { icon:'🌊', color:'#0284c7', bg:'#e0f2fe', label:'High moisture' };
    if (type === 'temp_high')      return { icon:'🌡️', color:'#dc2626', bg:'#fef2f2', label:'High temperature' };
    if (type === 'sensor_offline') return { icon:'📡', color:'#9ca3af', bg:'#f3f4f6', label:'Sensor offline' };
    return { icon:'⚠️', color:'#d97706', bg:'#fefce8', label: type };
  };

  return (
    <div style={{
      background:'#fff', borderRadius:16, padding:'14px 16px',
      border:'1.5px solid #fef08a', boxShadow:'0 2px 8px rgba(234,179,8,0.1)',
    }}>
      <div style={{ fontWeight:700, fontSize:13, color:'#1f2937', marginBottom:10 }}>🚨 Active Alerts</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {alerts.map(a => {
          const m = alertMeta(a.alert_type);
          return (
            <div key={a.id} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 12px', borderRadius:10, background:m.bg,
            }}>
              <span style={{ fontSize:18 }}>{m.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:m.color }}>{m.label}</div>
                {a.actual_value != null && (
                  <div style={{ fontSize:11, color:'#6b7280' }}>
                    Value: {a.actual_value}{a.threshold != null ? ` / threshold: ${a.threshold}` : ''}
                  </div>
                )}
              </div>
              <div style={{ fontSize:10, color:'#9ca3af' }}>
                {new Date(a.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DURATION_PRESETS = [
  { l: '5m',  s: 300 }, { l: '10m', s: 600 },
  { l: '15m', s: 900 }, { l: '30m', s: 1800 }, { l: '1hr', s: 3600 },
];
const DAYS_SHORT = ['M','T','W','T','F','S','S'];

const OUTPUT_META: Record<string, { icon: string; color: string; glow: string; bg: string; label: string }> = {
  valve1: { icon: '🪴', color: '#059669', glow: 'rgba(5,150,105,0.35)', bg: '#ecfdf5', label: 'Daily Water Plants' },
  valve2: { icon: '🌿', color: '#0891b2', glow: 'rgba(8,145,178,0.35)', bg: '#ecfeff', label: 'Occasional Water Plants' },
  valve3: { icon: '🌊', color: '#7c3aed', glow: 'rgba(124,58,237,0.35)', bg: '#f5f3ff', label: 'Misting' },
  relay1: { icon: '⚡', color: '#d97706', glow: 'rgba(217,119,6,0.35)',  bg: '#fffbeb', label: 'Motor or Light' },
};

/* ── Toggle switch ───────────────────────────────────────────────── */
function Toggle({ on, loading, disabled, color, onToggle }: {
  on: boolean; loading?: boolean; disabled?: boolean; color: string; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} disabled={disabled || loading} aria-pressed={on} style={{
      position:'relative', width:54, height:30, borderRadius:15, border:'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: on ? color : '#d1d5db',
      boxShadow: on ? `0 0 14px ${color}88, inset 0 1px 2px rgba(0,0,0,0.1)` : 'inset 0 2px 4px rgba(0,0,0,0.15)',
      transition:'background 0.25s, box-shadow 0.25s',
      opacity: disabled ? 0.4 : 1, flexShrink:0,
    }}>
      <span style={{
        position:'absolute', top:3, left: on ? 27 : 3,
        width:24, height:24, borderRadius:'50%',
        background: loading ? 'transparent' : '#fff',
        border: loading ? '2.5px solid rgba(255,255,255,0.7)' : 'none',
        borderTopColor: loading ? 'transparent' : undefined,
        boxShadow: loading ? 'none' : '0 2px 6px rgba(0,0,0,0.22)',
        transition:'left 0.25s cubic-bezier(.34,1.4,.64,1)',
        animation: loading ? 'spin 0.6s linear infinite' : 'none',
      }}/>
    </button>
  );
}

/* ── Mini schedule form (inline per output) ──────────────────────── */
function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function addMins(t: string, mins: number) {
  const total = (timeToMins(t) + mins) % (24 * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function diffSecs(start: string, end: string) {
  let diff = (timeToMins(end) - timeToMins(start)) * 60;
  if (diff <= 0) diff += 24 * 3600;
  return Math.min(diff, 3600);
}

function QuickSchedule({ outputKey, deviceId, onSaved }: {
  outputKey: string; deviceId: string; onSaved: () => void;
}) {
  const [startTime, setStart] = useState('06:00');
  const [endTime,   setEnd]   = useState('06:10');
  const [days, setDays]       = useState([1,2,3,4,5,6,7]);
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState('');

  const durationSecs = diffSecs(startTime, endTime);
  const durationLabel = durationSecs >= 3600
    ? `${durationSecs/3600}hr`
    : `${Math.round(durationSecs/60)} min`;

  const applyPreset = (secs: number) => setEnd(addMins(startTime, secs / 60));

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d].sort());

  const save = async () => {
    if (!days.length) { setErr('Pick at least one day'); return; }
    if (durationSecs < 60) { setErr('End time must be after start time'); return; }
    setSaving(true); setErr('');
    try {
      await api('/api/schedules', { method:'POST', body: JSON.stringify({
        device_id: deviceId, zone_or_output: outputKey,
        days_of_week: days, start_time: startTime,
        duration_seconds: durationSecs, enabled: true,
      })});
      setDone(true);
      setTimeout(() => { setDone(false); onSaved(); }, 1500);
    } catch(e:any) { setErr(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const meta = OUTPUT_META[outputKey] || OUTPUT_META.valve1;

  if (done) return (
    <div style={{ textAlign:'center', padding:'16px 0', color: meta.color, fontWeight:700, fontSize:14, animation:'fadeIn 0.3s ease' }}>
      ✅ Schedule saved!
    </div>
  );

  return (
    <div style={{ paddingTop:14, borderTop:'1.5px dashed #e5e7eb', marginTop:12, animation:'slideDown 0.25s ease' }}>
      {err && <div style={{ fontSize:12, color:'#dc2626', marginBottom:8 }}>⚠️ {err}</div>}

      {/* Start + End time */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Start Time</div>
          <input type="time" value={startTime} onChange={e=>setStart(e.target.value)} style={{
            width:'100%', padding:'8px 6px', borderRadius:10, border:`1.5px solid ${meta.color}44`,
            fontSize:15, fontWeight:700, color:'#1f2937', background:'#f9fafb',
            outline:'none', textAlign:'center', boxSizing:'border-box',
          }}/>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>End Time</div>
          <input type="time" value={endTime} onChange={e=>setEnd(e.target.value)} style={{
            width:'100%', padding:'8px 6px', borderRadius:10, border:`1.5px solid ${meta.color}44`,
            fontSize:15, fontWeight:700, color:'#1f2937', background:'#f9fafb',
            outline:'none', textAlign:'center', boxSizing:'border-box',
          }}/>
        </div>
      </div>

      {/* Duration display */}
      <div style={{ textAlign:'center', fontSize:12, color: meta.color, fontWeight:700, marginBottom:10 }}>
        ⏱ Duration: {durationLabel}
      </div>

      {/* Duration presets */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Quick Presets</div>
        <div style={{ display:'flex', gap:4 }}>
          {DURATION_PRESETS.map(p=>(
            <button key={p.s} type="button" onClick={()=>applyPreset(p.s)} style={{
              flex:1, padding:'7px 0', borderRadius:8, border:'none',
              background: durationSecs===p.s ? meta.color : '#f3f4f6',
              color: durationSecs===p.s ? '#fff' : '#6b7280',
              fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
            }}>{p.l}</button>
          ))}
        </div>
      </div>

      {/* Days */}
      <div style={{ marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em' }}>Repeat</div>
          <button type="button" onClick={()=>setDays([1,2,3,4,5,6,7])} style={{
            fontSize:10, color: meta.color, fontWeight:700, background:'none', border:'none', cursor:'pointer',
          }}>Every day</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {DAYS_SHORT.map((d,i)=>{
            const v=i+1, active=days.includes(v);
            return (
              <button key={v} type="button" onClick={()=>toggleDay(v)} style={{
                padding:'7px 0', borderRadius:8, border:'none',
                background: active ? meta.color : '#f3f4f6',
                color: active ? '#fff' : '#9ca3af',
                fontSize:11, fontWeight:700, cursor:'pointer',
                boxShadow: active ? `0 2px 6px ${meta.glow}` : 'none',
                transition:'all 0.15s',
              }}>{d}</button>
            );
          })}
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{
        width:'100%', padding:'10px 0', borderRadius:10, border:'none',
        background: saving ? '#e5e7eb' : `linear-gradient(135deg,${meta.color},${meta.color}cc)`,
        color:'#fff', fontSize:13, fontWeight:700, cursor: saving ? 'default' : 'pointer',
        boxShadow: saving ? 'none' : `0 4px 14px ${meta.glow}`,
        transition:'all 0.2s',
      }}>
        {saving ? 'Saving…' : '⏰ Save Schedule'}
      </button>
    </div>
  );
}

/* ── Output card ─────────────────────────────────────────────────── */
function OutputCard({ outputKey, isOn, loading, isOnline, deviceId, onToggle, onScheduleSaved }: {
  outputKey: string; isOn: boolean; loading: boolean; isOnline: boolean;
  deviceId: string; onToggle: ()=>void; onScheduleSaved: ()=>void;
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const meta = OUTPUT_META[outputKey] || OUTPUT_META.valve1;

  return (
    <div style={{
      background: isOn ? meta.bg : '#fff',
      borderRadius:18, padding:'14px 16px',
      border:`1.5px solid ${isOn ? meta.color+'55' : '#e5e7eb'}`,
      boxShadow: isOn ? `0 6px 24px ${meta.glow}` : '0 2px 8px rgba(0,0,0,0.05)',
      transition:'all 0.3s', position:'relative', overflow:'hidden',
    }}>

      {/* Pulse dot when ON */}
      {isOn && !loading && (
        <span style={{
          position:'absolute', top:12, right:12, width:9, height:9,
          borderRadius:'50%', background: meta.color,
          animation:'pulseRing 1.8s ease-out infinite',
        }}/>
      )}

      {/* Icon + label + toggle row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 12 }}>
        {/* Icon */}
        <div style={{
          width:44, height:44, borderRadius:14,
          background: isOn ? meta.color+'22' : '#f3f4f6',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:22, transition:'all 0.3s',
          filter: isOn ? 'none' : 'grayscale(0.5)',
          flexShrink:0,
        }}>{meta.icon}</div>

        {/* Label + status */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:800, fontSize:14, color: isOn ? meta.color : '#1f2937', lineHeight:1.2 }}>
            {meta.label}
          </div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase',
            color: loading ? '#9ca3af' : isOn ? meta.color : '#9ca3af', marginTop:2 }}>
            {loading ? 'Updating…' : isOn ? '● Running' : '○ Idle'}
          </div>
        </div>

        {/* Toggle */}
        <Toggle on={isOn} loading={loading} disabled={!isOnline} color={meta.color} onToggle={onToggle}/>
      </div>

      {/* Schedule button */}
      <button onClick={()=>setShowSchedule(s=>!s)} style={{
        width:'100%', padding:'8px 0', borderRadius:10, marginTop:10,
        border:`1.5px solid ${showSchedule ? meta.color : '#e5e7eb'}`,
        background: showSchedule ? meta.color+'18' : '#f9fafb',
        color: showSchedule ? meta.color : '#6b7280',
        fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.2s',
      }}>📅 {showSchedule ? 'Hide Schedule' : 'Set Schedule'}</button>

      {showSchedule && (
        <QuickSchedule
          outputKey={outputKey}
          deviceId={deviceId}
          onSaved={() => { setShowSchedule(false); onScheduleSaved(); }}
        />
      )}
    </div>
  );
}

/* ── Live Sensor Panel ───────────────────────────────────────────── */
function LiveSensorPanel({ deviceId, isPremium }: { deviceId: string; isPremium: boolean }) {
  const [moisture, setMoisture] = useState<number | null>(null);
  const [temp,     setTemp]     = useState<number | null>(null);
  const [age,      setAge]      = useState<string>('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const r = await api<{ latest: { moisture_pct: number | null; temp_c: number | null; recorded_at: string } | null }>(
          `/api/sensors/${deviceId}`
        );
        if (r.latest) {
          setMoisture(r.latest.moisture_pct);
          setTemp(r.latest.temp_c);
          const secs = Math.floor((Date.now() - new Date(r.latest.recorded_at).getTime()) / 1000);
          setAge(secs < 60 ? 'just now' : `${Math.floor(secs/60)}m ago`);
        }
      } catch {}
    };
    fetch();
    const iv = setInterval(fetch, 10000);
    return () => clearInterval(iv);
  }, [deviceId]);

  const mColor = moisture == null ? '#9ca3af' : moisture < 30 ? '#ef4444' : moisture < 60 ? '#f59e0b' : '#10b981';
  const tColor = temp == null ? '#9ca3af' : temp > 38 ? '#ef4444' : temp > 30 ? '#f59e0b' : '#3b82f6';
  const mLabel = moisture == null ? 'No data' : moisture < 30 ? '🔴 Dry — needs water' : moisture < 60 ? '🟡 Moderate' : '🟢 Well watered';
  const tLabel = temp == null ? 'No data' : temp > 38 ? '🔴 Very hot' : temp > 30 ? '🟡 Warm' : '🟢 Cool';

  return (
    <div style={{
      borderRadius: 18, overflow: 'hidden', marginBottom: 16,
      boxShadow: '0 4px 24px rgba(14,165,233,0.12)',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>🌱 Soil Sensor</div>
        {age && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Updated {age}</div>}
      </div>

      {/* Two metric cards side by side */}
      <div style={{ background: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#f1f5f9' }}>

        {/* Moisture card */}
        <div style={{ background: '#fff', padding: '20px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            💧 Moisture
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: mColor, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10, transition: 'color 0.5s' }}>
            {moisture == null ? '—' : `${Math.round(moisture * 10) / 10}%`}
          </div>
          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.min(moisture ?? 0, 100)}%`,
              background: `linear-gradient(90deg,${mColor}bb,${mColor})`,
              transition: 'width 1.2s ease, background 0.5s',
            }}/>
          </div>
          <div style={{ fontSize: 11, color: mColor, fontWeight: 600, transition: 'color 0.5s' }}>{mLabel}</div>
        </div>

        {/* Temperature card */}
        <div style={{ background: '#fff', padding: '20px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            🌡️ Temperature
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: tColor, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10, transition: 'color 0.5s' }}>
            {temp == null ? '—' : `${Math.round(temp * 10) / 10}°C`}
          </div>
          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.min(((temp ?? 0) / 50) * 100, 100)}%`,
              background: `linear-gradient(90deg,${tColor}bb,${tColor})`,
              transition: 'width 1.2s ease, background 0.5s',
            }}/>
          </div>
          <div style={{ fontSize: 11, color: tColor, fontWeight: 600, transition: 'color 0.5s' }}>{tLabel}</div>
        </div>
      </div>

      {/* Premium automation prompt */}
      {!isPremium && (
        <div style={{
          background: 'linear-gradient(135deg,#fefce8,#fef9c3)',
          padding: '10px 16px', borderTop: '1px solid #fde68a',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>Auto-water by sensor</div>
            <div style={{ fontSize: 10, color: '#b45309' }}>Upgrade to Premium to automate valves by moisture &amp; temp</div>
          </div>
        </div>
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
  const [sub, setSub]               = useState<Subscription | null>(null);
  const [zoneNames, setZoneNames]   = useState<Record<string, string>>({});
  const [availableValves, setAvailableValves] = useState<string[]>(['valve1','valve2','valve3','relay1']);
  const [activeTab, setActiveTab]   = useState<'classic' | 'relays' | 'sensors' | 'automation'>('relays');
  const [cmdTick, setCmdTick]       = useState(0);
  const timerRef = useRef<any>(null);

  const isPremium = sub?.plan_name === 'premium';

  const load = useCallback(async () => {
    try {
      const d = await api<Detail>(`/api/devices/${id}`);
      setData(d);
      setErr(null);
      setOptimistic(prev => {
        if (!Object.keys(prev).length) return prev;
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          const serverVal = !!d.last_status?.[`${key}_state`];
          if (serverVal === next[key]) delete next[key];
        }
        return next;
      });
    } catch (e: any) { setErr(e.message || 'Failed to load device'); }
  }, [id]);

  // Load subscription, zone names, relay licenses
  useEffect(() => {
    api<{ subscription: Subscription | null }>('/api/subscriptions/me')
      .then(s => setSub(s.subscription)).catch(() => {});
    api<{ zones: Record<string, string> }>(`/api/devices/${id}/zones`)
      .then(z => setZoneNames(z.zones ?? {})).catch(() => {});
    api<{ licenses: Array<{ relay_key: string; activated: boolean }> }>(`/api/relays/${id}/licenses`)
      .then(r => {
        const extra = r.licenses.filter(l => l.activated).map(l => l.relay_key);
        setAvailableValves(['valve1','valve2','valve3','relay1', ...extra]);
      }).catch(() => {});
  }, [id, cmdTick]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 2000);
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

  const { device, last_status, plan } = data;
  if (!plan) return <AppShell><div className="card text-red-600 text-sm">⚠️ Device plan not configured.</div></AppShell>;

  const isOnline = device.status === 'online';
  const outputs: string[] = plan.allowedOutputs ?? [];

  const isOn = (key: string) =>
    key in optimistic ? optimistic[key] : !!last_status?.[`${key}_state`];

  const send = async (command_type: string, payload: Record<string, any> = {}) => {
    const key = payload.target || 'relay1';
    setLoadingKey(key);
    try {
      await api(`/api/devices/${id}/commands`, {
        method:'POST',
        body: JSON.stringify({ command_type, payload, source:'manual' }),
      });
      await load();
    } catch (e: any) {
      setErr(e.message);
      setOptimistic(s => { const n={...s}; delete n[key]; return n; });
    } finally { setLoadingKey(null); }
  };

  const toggle = (key: string) => {
    const next = !isOn(key);
    setOptimistic(s => ({ ...s, [key]: next }));
    if (key === 'relay1') send(next ? 'relay_on' : 'relay_off');
    else send(next ? 'valve_on' : 'valve_off', { target: key });
  };

  const valves = outputs.filter((o:string) => o.startsWith('valve'));
  const hasRelay = outputs.includes('relay1');

  return (
    <AppShell>
      <style>{`
        @keyframes pulseRing { 0%{box-shadow:0 0 0 0 rgba(16,185,129,0.6)} 70%{box-shadow:0 0 0 10px rgba(16,185,129,0)} 100%{box-shadow:0 0 0 0 rgba(16,185,129,0)} }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background:'linear-gradient(135deg,#064e3b 0%,#065f46 60%,#047857 100%)',
        borderRadius:20, padding:'18px 20px', marginBottom:20, color:'#fff',
        boxShadow:'0 8px 28px rgba(6,78,59,0.4)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-0.02em' }}>{device.device_name}</div>
            <div style={{ fontSize:11, opacity:0.6, marginTop:2 }}>{device.device_uid}</div>
            <div style={{ display:'inline-block', marginTop:8, padding:'3px 10px', borderRadius:20,
              background:'rgba(255,255,255,0.15)', fontSize:11, fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.05em' }}>{plan.plan} plan</div>
          </div>
          <div style={{
            display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20,
            background: isOnline ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.1)',
            border:`1px solid ${isOnline ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.2)'}`,
          }}>
            <span style={{ width:8, height:8, borderRadius:'50%', display:'inline-block',
              background: isOnline ? '#34d399' : '#6b7280',
              boxShadow: isOnline ? '0 0 8px #34d399' : 'none',
              animation: isOnline ? 'pulseRing 2s infinite' : 'none' }}/>
            <span style={{ fontSize:12, fontWeight:700 }}>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* ── Live Sensor Panel ── */}
      <LiveSensorPanel deviceId={id} isPremium={isPremium} />

      {/* ── Output controls ── */}
      <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:10, letterSpacing:'-0.01em' }}>
        Controls & Schedules
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
        {valves.map(v => (
          <OutputCard key={v} outputKey={v}
            isOn={isOn(v)} loading={loadingKey===v}
            isOnline={isOnline} deviceId={id}
            onToggle={()=>toggle(v)}
            onScheduleSaved={load}
          />
        ))}
        {hasRelay && (
          <OutputCard outputKey="relay1"
            isOn={isOn('relay1')} loading={loadingKey==='relay1'}
            isOnline={isOnline} deviceId={id}
            onToggle={()=>toggle('relay1')}
            onScheduleSaved={load}
          />
        )}
      </div>

      {/* ── Stop all ── */}
      <button onClick={()=>{ setOptimistic({}); send('stop_all'); }}
        disabled={!isOnline} style={{
          width:'100%', padding:'14px 0', borderRadius:14, border:'none',
          background: isOnline ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : '#e5e7eb',
          color: isOnline ? '#fff' : '#9ca3af', fontSize:14, fontWeight:800,
          cursor: isOnline ? 'pointer' : 'not-allowed',
          boxShadow: isOnline ? '0 4px 18px rgba(220,38,38,0.35)' : 'none',
          transition:'all 0.2s', marginBottom:16,
        }}>■ Stop Everything</button>

      {/* ── Voice ── */}
      {plan.hasVoice && (
        <div style={{ marginBottom:16 }}>
          <VoiceButton deviceId={device.id} disabled={!isOnline} onCommand={load}/>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ── Advanced tabs: Relays · Sensors · Automation ──
          ════════════════════════════════════════════════════════ */}
      <div style={{ marginTop:8, marginBottom:12 }}>
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5,
          background:'#f1f5f9', borderRadius:14, padding:4,
        }}>
          {([
            { key:'relays',     label:'🎛️ Relays'    },
            { key:'sensors',    label:'📊 Sensors'   },
            { key:'automation', label:'🤖 Auto'      },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding:'8px 0', borderRadius:10, border:'none', cursor:'pointer',
                background: activeTab === t.key ? '#fff' : 'transparent',
                color: activeTab === t.key ? '#1f2937' : '#64748b',
                fontWeight:700, fontSize:12,
                boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition:'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Relays tab ── */}
      {activeTab === 'relays' && (
        <div style={{ marginBottom:16 }}>
          <RelayCard
            deviceId={id}
            isPremium={isPremium}
            zoneNames={zoneNames}
            onCommand={() => { load(); setCmdTick(t => t + 1); }}
          />
        </div>
      )}

      {/* ── Sensors tab ── */}
      {activeTab === 'sensors' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
          <SensorGraph deviceId={id} />
          <SensorAlerts deviceId={id} />
        </div>
      )}

      {/* ── Automation tab ── */}
      {activeTab === 'automation' && (
        <div style={{ marginBottom:16 }}>
          {isPremium ? (
            <AutomationRuleBuilder
              deviceId={id}
              availableValves={availableValves}
              zoneNames={zoneNames}
            />
          ) : (
            <div style={{
              background:'linear-gradient(135deg,#fdf4ff,#fae8ff)',
              borderRadius:18, padding:'28px 20px', textAlign:'center',
              border:'1.5px solid #e9d5ff',
              boxShadow:'0 4px 20px rgba(168,85,247,0.1)',
            }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🤖</div>
              <div style={{ fontWeight:800, fontSize:16, color:'#581c87', marginBottom:6 }}>
                Smart Automation
              </div>
              <div style={{ fontSize:13, color:'#7c3aed', marginBottom:18, lineHeight:1.5 }}>
                Auto-water your plants based on real-time<br/>soil moisture and temperature readings.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20, textAlign:'left' }}>
                {[
                  '💧 Turn valve ON when moisture drops below 30%',
                  '🌡️ Turn valve OFF when temperature drops below 28°C',
                  '⏰ Set time windows + max run duration',
                  '🔄 Works offline — rules run on device',
                ].map(f => (
                  <div key={f} style={{ fontSize:12, color:'#6d28d9' }}>{f}</div>
                ))}
              </div>
              <a href="/subscription" style={{
                display:'inline-block', padding:'12px 28px', borderRadius:12,
                background:'linear-gradient(135deg,#7c3aed,#6d28d9)',
                color:'#fff', fontWeight:800, fontSize:14, textDecoration:'none',
                boxShadow:'0 4px 18px rgba(124,58,237,0.4)',
              }}>
                ⚡ Upgrade to Premium
              </a>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function DevicePageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');
  useEffect(()=>{ if(!id) router.replace('/devices'); }, [id, router]);
  if (!id) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'#6b7280',fontSize:14}}>Redirecting…</div></div>;
  return <DeviceContent id={id}/>;
}

export default function DevicePage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'#6b7280',fontSize:14}}>Loading…</div></div>}>
      <DevicePageInner/>
    </Suspense>
  );
}
