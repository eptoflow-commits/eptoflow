'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import VoiceButton from '@/components/VoiceButton';
import { api } from '@/lib/api';
import type { Command, Device, Plan } from '@/lib/types';

type Detail = { device: Device; last_status: any; recent_commands: Command[]; plan: Plan };

const DURATION_PRESETS = [
  { l: '5m',  s: 300 }, { l: '10m', s: 600 },
  { l: '15m', s: 900 }, { l: '30m', s: 1800 }, { l: '1hr', s: 3600 },
];
const DAYS_SHORT = ['M','T','W','T','F','S','S'];

const OUTPUT_META: Record<string, { icon: string; color: string; glow: string; bg: string; label: string }> = {
  valve1: { icon: '🪴', color: '#059669', glow: 'rgba(5,150,105,0.35)', bg: '#ecfdf5', label: 'Daily Water Plants' },
  valve2: { icon: '🌿', color: '#0891b2', glow: 'rgba(8,145,178,0.35)', bg: '#ecfeff', label: 'Occasional Water Plants' },
  valve3: { icon: '🌊', color: '#7c3aed', glow: 'rgba(124,58,237,0.35)', bg: '#f5f3ff', label: 'Misting' },
  relay1: { icon: '⚡', color: '#d97706', glow: 'rgba(217,119,6,0.35)',  bg: '#fffbeb', label: 'Motor' },
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
  const moisture = last_status?.moisture_value ?? null;
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

      {/* ── Moisture ── */}
      {plan.hasMoisture && (
        <div style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', borderRadius:16,
          border:'1.5px solid #bfdbfe', padding:'14px 18px', marginBottom:16,
          boxShadow:'0 2px 12px rgba(59,130,246,0.1)' }}>
          <div style={{ fontSize:11, color:'#3b82f6', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
            🌱 Soil Moisture
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ fontSize:38, fontWeight:900, color:'#1d4ed8', lineHeight:1 }}>
              {moisture==null ? '—' : `${moisture}%`}
            </div>
            {moisture!=null && (
              <div style={{ flex:1 }}>
                <div style={{ height:10, background:'#bfdbfe', borderRadius:6, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${moisture}%`, borderRadius:6,
                    background:'linear-gradient(90deg,#3b82f6,#60a5fa)',
                    boxShadow:'0 0 8px rgba(59,130,246,0.4)', transition:'width 1s ease' }}/>
                </div>
                <div style={{ fontSize:11, color:'#60a5fa', marginTop:4 }}>
                  {moisture<30 ? '🔴 Dry — needs water' : moisture<65 ? '🟡 Moderate' : '🟢 Well watered'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
