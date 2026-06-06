'use client';

import { Suspense, useState, useEffect, useCallback, useRef, Component, type ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import VoiceButton from '@/components/VoiceButton';
import SensorGraph from '@/components/SensorGraph';
import AutomationRuleBuilder from '@/components/AutomationRuleBuilder';
import { api } from '@/lib/api';
import type { Command, Device, Plan, Subscription } from '@/lib/types';

type Detail = { device: Device; last_status: any; recent_commands: Command[]; plan: Plan };

// ── Error boundary for Sensor Auto tab ───────────────────────────────────────
class SensorAutoErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: any) {
    return { error: err?.message ?? 'Unknown error' };
  }
  componentDidCatch(err: any, info: any) {
    console.error('[SensorAuto] render error:', err, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 16,
          padding: '20px 18px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
            Sensor Auto failed to load
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
            {this.state.error}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none',
              background: '#dc2626', color: '#fff', fontWeight: 700,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      .then(r => setAlerts(Array.isArray(r?.alerts) ? r.alerts : []))
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
  valve1: { icon: '🪴', color: '#059669', glow: 'rgba(5,150,105,0.35)', bg: '#ecfdf5', label: 'Daily Watering' },
  valve2: { icon: '🌿', color: '#0891b2', glow: 'rgba(8,145,178,0.35)', bg: '#ecfeff', label: 'Occasional Watering' },
  valve3: { icon: '🌊', color: '#7c3aed', glow: 'rgba(124,58,237,0.35)', bg: '#f5f3ff', label: 'Misting' },
  relay1: { icon: '⚡', color: '#d97706', glow: 'rgba(217,119,6,0.35)',  bg: '#fffbeb', label: 'Motor / Light' },
  relay6: { icon: '💊', color: '#e11d48', glow: 'rgba(225,29,72,0.35)',  bg: '#fff1f2', label: 'MediSpray' },
  relay7: { icon: '💧', color: '#0369a1', glow: 'rgba(3,105,161,0.35)',  bg: '#eff6ff', label: 'Extra Zone 1' },
  relay8: { icon: '💧', color: '#0369a1', glow: 'rgba(3,105,161,0.35)',  bg: '#eff6ff', label: 'Extra Zone 2' },
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
          setMoisture(r.latest.moisture_pct != null ? Number(r.latest.moisture_pct) : null);
          setTemp(r.latest.temp_c != null ? Number(r.latest.temp_c) : null);
          const secs = Math.floor((Date.now() - new Date(r.latest.recorded_at).getTime()) / 1000);
          setAge(secs < 60 ? 'just now' : `${Math.floor(secs/60)}m ago`);
        }
      } catch {}
    };
    fetch();
    const iv = setInterval(fetch, 10000);
    return () => clearInterval(iv);
  }, [deviceId]);

  const mColor = moisture == null ? '#9ca3af' : moisture < 30 ? '#ef4444' : moisture < 60 ? '#f59e0b' : '#22C55E';
  const tColor = temp == null ? '#9ca3af' : temp > 38 ? '#ef4444' : temp > 30 ? '#f59e0b' : '#0EA5E9';
  const mLabel = moisture == null ? 'No data' : moisture < 30 ? 'Dry — needs water' : moisture < 60 ? 'Moderate' : 'Well watered';
  const tLabel = temp == null ? 'No data' : temp > 38 ? 'Very hot' : temp > 30 ? 'Warm' : 'Cool';

  /* Mini SVG arc gauge */
  const ArcMini = ({ value, max, color }: { value:number; max:number; color:string }) => {
    const r = 28, cx = 36, cy = 36;
    const circ = Math.PI * r;
    const pct  = Math.min(1, Math.max(0, value/max));
    return (
      <svg width={72} height={44} viewBox="0 0 72 44" style={{ overflow:'visible' }}>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round"/>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${pct*circ} ${circ}`} style={{ transition:'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}/>
      </svg>
    );
  };

  return (
    <div style={{
      borderRadius:22, overflow:'hidden', marginBottom:16,
      boxShadow:'0 6px 28px rgba(13,92,61,0.18)',
    }}>
      {/* Dark header with inline sensor values */}
      <div style={{
        background:'linear-gradient(160deg,#0F1F17 0%,#0D5C3D 100%)',
        padding:'16px 18px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:11, background:'rgba(34,197,94,0.18)', border:'1px solid rgba(34,197,94,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌱</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff', letterSpacing:'-0.01em' }}>Soil Sensor</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginTop:1 }}>RS485 Modbus · 10s refresh</div>
          </div>
        </div>
        {age && <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:600 }}>Updated {age}</div>}
      </div>

      {/* Two metric panels */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', background:'#0F1F17' }}>

        {/* Moisture */}
        <div style={{ padding:'18px 16px', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', alignItems:'center' }}>
          <ArcMini value={moisture??0} max={100} color={mColor} />
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>💧 Moisture</div>
          <div style={{ fontSize:38, fontWeight:900, color:mColor, letterSpacing:'-0.04em', lineHeight:1, transition:'color 0.5s' }}>
            {moisture == null ? '—' : `${(Math.round(moisture*10)/10)}%`}
          </div>
          <div style={{ marginTop:8, fontSize:11, fontWeight:700, color:mColor, background:`${mColor}20`, padding:'3px 10px', borderRadius:20, transition:'all 0.5s' }}>{mLabel}</div>
          <div style={{ marginTop:10, width:'100%', height:5, background:'rgba(255,255,255,0.08)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:99, width:`${Math.min(moisture??0,100)}%`, background:`linear-gradient(90deg,${mColor}80,${mColor})`, transition:'width 1.2s ease' }}/>
          </div>
        </div>

        {/* Temperature */}
        <div style={{ padding:'18px 16px', display:'flex', flexDirection:'column', alignItems:'center' }}>
          <ArcMini value={temp??0} max={50} color={tColor} />
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>🌡️ Temp</div>
          <div style={{ fontSize:38, fontWeight:900, color:tColor, letterSpacing:'-0.04em', lineHeight:1, transition:'color 0.5s' }}>
            {temp == null ? '—' : `${(Math.round(temp*10)/10)}°C`}
          </div>
          <div style={{ marginTop:8, fontSize:11, fontWeight:700, color:tColor, background:`${tColor}20`, padding:'3px 10px', borderRadius:20, transition:'all 0.5s' }}>{tLabel}</div>
          <div style={{ marginTop:10, width:'100%', height:5, background:'rgba(255,255,255,0.08)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:99, width:`${Math.min(((temp??0)/50)*100,100)}%`, background:`linear-gradient(90deg,${tColor}80,${tColor})`, transition:'width 1.2s ease' }}/>
          </div>
        </div>
      </div>

      {/* Upgrade strip (non-premium) */}
      {!isPremium && (
        <div style={{ background:'#0A1A10', padding:'10px 18px', display:'flex', alignItems:'center', gap:10, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize:16 }}>⚡</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#F59E0B' }}>Auto-water by sensor</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>Upgrade to Premium to automate valves by moisture &amp; temp</div>
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
  const [activeTab, setActiveTab]   = useState<'manual' | 'schedule' | 'auto'>('manual');
  const [cmdTick, setCmdTick]       = useState(0); // kept for license refresh
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

  // Keep Render backend awake while device page is open (free tier sleeps after 15 min)
  useEffect(() => {
    const ping = () => fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/health`).catch(() => {});
    ping();
    const iv = setInterval(ping, 30000); // every 30 s
    return () => clearInterval(iv);
  }, []);

  if (err) return (
    <AppShell>
      <div style={{ background:'#fef2f2', borderRadius:20, padding:'20px 18px', border:'1.5px solid #fecaca', display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:24 }}>⚠️</span>
        <div>
          <div style={{ fontWeight:800, color:'#dc2626', fontSize:14 }}>Failed to load device</div>
          <div style={{ fontSize:12, color:'#f87171', marginTop:2 }}>{err}</div>
        </div>
      </div>
    </AppShell>
  );
  if (!data) return (
    <AppShell>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}.sk{background:linear-gradient(105deg,#e2e8f0 35%,#f8fafc 50%,#e2e8f0 65%);background-size:200% 100%;animation:shimmer 1.6s ease-in-out infinite;border-radius:16px}`}</style>
      <div className="sk" style={{ height:110, marginBottom:16, borderRadius:24 }}/>
      <div className="sk" style={{ height:130, marginBottom:16, borderRadius:22 }}/>
      <div className="sk" style={{ height:52, marginBottom:16, borderRadius:16 }}/>
      {[1,2,3].map(i=><div key={i} className="sk" style={{ height:90, marginBottom:10, borderRadius:20 }}/>)}
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
    // relay6/7/8 handled by valve_on/valve_off with target
  };

  const valves = outputs.filter((o:string) => o.startsWith('valve'));
  const hasRelay = outputs.includes('relay1');
  // Addon valves activated by admin (relay6/7/8) — shown in Controls with schedule
  const addonValves = availableValves.filter(k => ['relay6','relay7','relay8'].includes(k));

  return (
    <AppShell>
      <style>{`
        /* Keyframes */
        @keyframes pulseRing  { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.65)} 70%{box-shadow:0 0 0 10px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        @keyframes spin       { to { transform:rotate(360deg); } }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown  { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes waterFlow  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes waterDripIcon { 0%{transform:translateX(-50%) translateY(-4px);opacity:0} 30%{opacity:1} 100%{transform:translateX(-50%) translateY(14px);opacity:0} }
        @keyframes pulseDot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.75)} }
        @keyframes heroGlow   { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        .zone-card-press:active { transform:scale(0.983) !important; }

        /* ── Responsive device layout ── */
        .device-hero { margin:0 -16px; }
        .device-layout { display:flex; flex-direction:column; gap:16px; }
        .device-col-left { width:100%; }
        .device-col-right { width:100%; }
        .zone-grid { display:flex; flex-direction:column; gap:10px; }

        @media(min-width:640px) {
          .device-hero { margin:0 -28px; }
        }
        @media(min-width:768px) {
          .device-hero { margin:0 -28px; }
          .zone-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
          .zone-stop-btn { grid-column:1/-1; }
        }
        @media(min-width:1024px) {
          .device-hero { margin:0 -40px; }
          .device-layout { flex-direction:row; align-items:flex-start; gap:22px; }
          .device-col-left { width:340px; flex-shrink:0; position:sticky; top:78px; }
          .device-col-right { flex:1; min-width:0; }
        }
      `}</style>

      {/* ══════════════════════════════════════════
          HERO — full bleed, animated dark gradient
      ══════════════════════════════════════════ */}
      <div className="device-hero" style={{
        background:'linear-gradient(160deg,#060F0A 0%,#0F2118 55%,#0D5C3D 100%)',
        backgroundSize:'200% 200%',
        padding:'24px 28px 0', color:'#fff', position:'relative', overflow:'hidden',
        marginBottom:20,
      }}>
        {/* Animated ambient blobs */}
        <div style={{ position:'absolute', top:-50, right:-30, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(34,197,94,0.16) 0%,transparent 70%)', animation:'heroGlow 4s ease-in-out infinite', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:0, left:-30, width:150, height:150, borderRadius:'50%', background:'radial-gradient(circle,rgba(14,165,233,0.10) 0%,transparent 70%)', pointerEvents:'none' }}/>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>
              Irrigation Controller
            </div>
            <div style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1, marginBottom:6 }}>
              {device.device_name}
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)', fontFamily:'monospace', marginBottom:12 }}>
              {device.device_uid}
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 14px', borderRadius:20, background:'rgba(255,255,255,0.09)', border:'1px solid rgba(255,255,255,0.14)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>
              ✨ {plan.plan} plan
            </div>
          </div>

          {/* Status badge — large, noticeable */}
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6,
          }}>
            <div style={{
              display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:22,
              background: isOnline ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.14)',
              border:`1px solid ${isOnline ? 'rgba(34,197,94,0.40)' : 'rgba(239,68,68,0.30)'}`,
              boxShadow: isOnline ? '0 0 20px rgba(34,197,94,0.15)' : 'none',
            }}>
              <span style={{ width:10, height:10, borderRadius:'50%', display:'inline-block',
                background: isOnline ? '#22C55E' : '#ef4444',
                boxShadow: isOnline ? '0 0 10px #22C55E, 0 0 20px rgba(34,197,94,0.5)' : '0 0 8px #ef4444',
                animation: isOnline ? 'pulseRing 2s infinite' : 'none' }}/>
              <span style={{ fontSize:13, fontWeight:800, color: isOnline ? '#22C55E' : '#f87171', letterSpacing:'-0.01em' }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Wave bottom edge */}
        <svg viewBox="0 0 1200 32" style={{ display:'block', width:'100%', height:32, marginBottom:-1 }} preserveAspectRatio="none">
          <path d="M0 32 L0 18 Q150 0 300 16 Q450 32 600 18 Q750 4 900 18 Q1050 32 1200 16 L1200 32 Z" fill="var(--fog)"/>
        </svg>
      </div>

      {/* ══════════════════════════════════════════
          RESPONSIVE TWO-COLUMN LAYOUT
      ══════════════════════════════════════════ */}
      <div className="device-layout">

        {/* LEFT COL — Sensor panel (sticky on desktop) */}
        <div className="device-col-left">
          <LiveSensorPanel deviceId={id} isPremium={isPremium} />
        </div>

        {/* RIGHT COL — Tabs + Controls */}
        <div className="device-col-right">

      {/* ══ Premium segmented tab bar ══ */}
      <div style={{ marginBottom:16 }}>
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3,1fr)',
          background:'#0F1F17', borderRadius:20, padding:5,
          boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
        }}>
          {([
            { key:'manual',   icon:'🖐️', label:'Manual',      desc:'On / Off',  activeColor:'#22C55E', activeBg:'rgba(34,197,94,0.18)' },
            { key:'schedule', icon:'⏰', label:'Schedule',     desc:'Timer',     activeColor:'#0EA5E9', activeBg:'rgba(14,165,233,0.18)' },
            { key:'auto',     icon:'🤖', label:'Sensor Auto',  desc:'Threshold', activeColor:'#a78bfa', activeBg:'rgba(167,139,250,0.18)' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding:'11px 6px', borderRadius:16, cursor:'pointer',
                background: activeTab === t.key ? t.activeBg : 'transparent',
                color: activeTab === t.key ? t.activeColor : 'rgba(255,255,255,0.35)',
                fontWeight:800, fontSize:11,
                boxShadow: activeTab === t.key ? `0 0 16px ${t.activeColor}30, inset 0 1px 0 ${t.activeColor}30` : 'none',
                border: activeTab === t.key ? `1px solid ${t.activeColor}40` : '1px solid transparent',
                transition:'all 0.22s cubic-bezier(0.34,1.2,0.64,1)',
                transform: activeTab === t.key ? 'scale(1.03)' : 'scale(1)',
                fontFamily:'inherit',
              }}>
              <div style={{ fontSize:18, marginBottom:3 }}>{t.icon}</div>
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:'-0.01em' }}>{t.label}</div>
              <div style={{ fontSize:9, fontWeight:500, opacity:0.6, marginTop:1 }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: MANUAL ── */}
      {activeTab === 'manual' && (
        <div style={{ marginBottom:16 }}>
          <div className="zone-grid">

          {[...valves, ...(hasRelay ? ['relay1'] : []), ...addonValves].map((key, idx) => {
            const meta = OUTPUT_META[key] || OUTPUT_META.valve1;
            const on   = isOn(key);
            const busy = loadingKey === key;
            const label = zoneNames[key] || meta.label;

            return (
              <div key={key} style={{
                borderRadius: 22,
                background: on
                  ? `linear-gradient(135deg, ${meta.color}18 0%, ${meta.bg} 100%)`
                  : '#fff',
                border: `1.5px solid ${on ? meta.color + '60' : 'var(--haze)'}`,
                boxShadow: on
                  ? `0 8px 32px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,0.8)`
                  : '0 2px 8px rgba(0,0,0,0.05)',
                overflow: 'hidden',
                transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                animation: `fadeUp 0.4s ${idx * 0.06}s both`,
                position: 'relative',
              }}>

                {/* Running water animation strip */}
                {on && !busy && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
                    animation: 'waterFlow 2s linear infinite',
                  }}/>
                )}

                {/* Main row */}
                <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>

                  {/* Icon — large, vivid when ON */}
                  <div style={{
                    width: 58, height: 58, borderRadius: 18, flexShrink: 0,
                    background: on
                      ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`
                      : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28,
                    boxShadow: on ? `0 6px 20px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,0.3)` : 'none',
                    filter: !on && !busy ? 'grayscale(0.6) opacity(0.6)' : 'none',
                    transition: 'all 0.35s ease',
                    position: 'relative',
                  }}>
                    {meta.icon}
                    {/* Water drop drip when ON */}
                    {on && !busy && (
                      <span style={{
                        position: 'absolute', bottom: -2, left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 10, animation: 'waterDripIcon 1.8s ease-in infinite',
                        opacity: 0.8,
                      }}>💧</span>
                    )}
                  </div>

                  {/* Labels */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 900, fontSize: 16,
                      color: on ? meta.color : 'var(--ink)',
                      letterSpacing: '-0.02em', lineHeight: 1.1,
                      transition: 'color 0.3s',
                    }}>{label}</div>

                    {/* Status badge */}
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {busy ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${meta.color}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }}/>
                          <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>Updating…</span>
                        </div>
                      ) : on ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, boxShadow: `0 0 6px ${meta.color}`, animation: 'pulseRing 1.5s infinite' }}/>
                          <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Running</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: 'var(--fog)', border: '1px solid var(--haze)' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dust)', opacity: 0.5 }}/>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dust)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Idle</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Toggle — larger */}
                  <Toggle on={on} loading={busy} disabled={!isOnline} color={meta.color} onToggle={() => toggle(key)} />
                </div>

                {/* Timer preset row */}
                <div style={{
                  display: 'flex', gap: 6, padding: '0 16px 16px',
                }}>
                  {DURATION_PRESETS.map(p => (
                    <button key={p.s}
                      disabled={!isOnline || busy}
                      onClick={() => {
                        setOptimistic(s => ({ ...s, [key]: true }));
                        send('water_for', { target: key, duration: p.s });
                      }}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 12, border: 'none',
                        background: on ? `${meta.color}28` : 'var(--fog)',
                        color: on ? meta.color : 'var(--dust)',
                        fontSize: 12, fontWeight: 800,
                        cursor: isOnline && !busy ? 'pointer' : 'not-allowed',
                        opacity: isOnline ? 1 : 0.35,
                        transition: 'all 0.15s',
                        letterSpacing: '-0.01em',
                      }}
                    >{p.l}</button>
                  ))}
                </div>
              </div>
            );
          })}

          </div>{/* end zone-grid */}

          {/* ── Stop Everything ── */}
          <button
            onClick={() => { setOptimistic({}); send('stop_all'); }}
            disabled={!isOnline}
            style={{
              width: '100%', marginTop:12, padding: '17px 0', borderRadius: 18, border: 'none',
              background: isOnline
                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                : 'var(--haze)',
              color: isOnline ? '#fff' : 'var(--dust)',
              fontSize: 16, fontWeight: 900,
              cursor: isOnline ? 'pointer' : 'not-allowed',
              boxShadow: isOnline ? '0 4px 0 #7f1d1d, 0 10px 32px rgba(220,38,38,0.45)' : 'none',
              transition: 'all 0.15s',
              letterSpacing: '-0.02em',
              fontFamily:'inherit',
            }}
          >
            ■ Stop Everything
          </button>

          {/* Voice */}
          {plan.hasVoice && (
            <VoiceButton deviceId={device.id} disabled={!isOnline} onCommand={load}/>
          )}
        </div>
      )}

      {/* ── TAB 2: SCHEDULE ── */}
      {activeTab === 'schedule' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:16 }}>
          <div style={{ fontSize:12, color:'#64748b', textAlign:'center', marginBottom:4 }}>
            Set recurring schedules — device runs them automatically even when offline.
          </div>
          {[...valves, ...(hasRelay ? ['relay1'] : []), ...addonValves].map(key => {
            const meta = OUTPUT_META[key] || OUTPUT_META.valve1;
            return (
              <div key={key} style={{
                borderRadius:18, overflow:'hidden',
                border:`1.5px solid ${meta.color}30`,
                boxShadow:`0 2px 12px ${meta.glow}`,
                background:'#fff',
              }}>
                {/* Zone header */}
                <div style={{
                  background:`linear-gradient(135deg,${meta.color},${meta.color}cc)`,
                  padding:'12px 16px', display:'flex', alignItems:'center', gap:10,
                }}>
                  <span style={{ fontSize:22 }}>{meta.icon}</span>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15, color:'#fff' }}>
                      {zoneNames[key] || meta.label}
                    </div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>Set watering schedule</div>
                  </div>
                </div>
                {/* Schedule form */}
                <div style={{ padding:'14px 16px' }}>
                  <QuickSchedule outputKey={key} deviceId={id} onSaved={load}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 3: SENSOR AUTO ── */}
      {activeTab === 'auto' && (
        <SensorAutoErrorBoundary>
        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:16 }}>
          {/* Sensor graph for context */}
          <SensorGraph deviceId={id} />
          <SensorAlerts deviceId={id} />

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
            }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🤖</div>
              <div style={{ fontWeight:800, fontSize:16, color:'#581c87', marginBottom:6 }}>
                Sensor-Based Automation
              </div>
              <div style={{ fontSize:13, color:'#7c3aed', marginBottom:18, lineHeight:1.5 }}>
                Auto-water based on live soil moisture &amp; temperature.
              </div>
              {['💧 Turn ON when moisture &lt; 30%','🌡️ Turn OFF when temp cools','⏰ Time windows + safety cap','🔄 Runs offline on device'].map(f => (
                <div key={f} style={{ fontSize:12, color:'#6d28d9', marginBottom:6, textAlign:'left' }}>{f}</div>
              ))}
              <a href="/subscription" style={{
                display:'inline-block', marginTop:12, padding:'12px 28px', borderRadius:12,
                background:'linear-gradient(135deg,#7c3aed,#6d28d9)',
                color:'#fff', fontWeight:800, fontSize:14, textDecoration:'none',
              }}>⚡ Upgrade to Premium</a>
            </div>
          )}
        </div>
        </SensorAutoErrorBoundary>
      )}

        </div>{/* end device-col-right */}
      </div>{/* end device-layout */}

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
