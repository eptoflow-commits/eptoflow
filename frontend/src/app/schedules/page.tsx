'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Device, Schedule } from '@/lib/types';

const DAYS = [
  { v: 1, l: 'M', full: 'Mon' },
  { v: 2, l: 'T', full: 'Tue' },
  { v: 3, l: 'W', full: 'Wed' },
  { v: 4, l: 'T', full: 'Thu' },
  { v: 5, l: 'F', full: 'Fri' },
  { v: 6, l: 'S', full: 'Sat' },
  { v: 7, l: 'S', full: 'Sun' },
];

const DURATION_PRESETS = [
  { label: '5 min',  secs: 300 },
  { label: '10 min', secs: 600 },
  { label: '15 min', secs: 900 },
  { label: '20 min', secs: 1200 },
  { label: '30 min', secs: 1800 },
  { label: '1 hr',   secs: 3600 },
];

const VALVE_LABELS: Record<string, string> = {
  valve1: '💧 Valve 1',
  valve2: '🚿 Valve 2',
  valve3: '🌊 Valve 3',
  relay1: '⚡ Motor / Relay',
};

export default function SchedulesPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [form, setForm]         = useState({
    device_id: '',
    zone_or_output: 'valve1',
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    start_time: '06:00',
    duration_seconds: 600,
    enabled: true,
  });

  const load = async () => {
    try {
      const [d, s] = await Promise.all([
        api<{ devices: Device[] }>('/api/devices'),
        api<{ schedules: Schedule[] }>('/api/schedules'),
      ]);
      setDevices(d.devices);
      setSchedules(s.schedules);
      if (!form.device_id && d.devices[0]) {
        setForm(f => ({ ...f, device_id: d.devices[0].id }));
      }
    } catch {}
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const toggleDay = (v: number) => {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(v)
        ? f.days_of_week.filter(x => x !== v)
        : [...f.days_of_week, v].sort(),
    }));
  };

  const setAllDays = () => setForm(f => ({ ...f, days_of_week: [1,2,3,4,5,6,7] }));
  const setWeekdays = () => setForm(f => ({ ...f, days_of_week: [1,2,3,4,5] }));
  const setWeekend = () => setForm(f => ({ ...f, days_of_week: [6,7] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setSaving(true);
    try {
      await api('/api/schedules', { method: 'POST', body: JSON.stringify(form) });
      await load();
      setShowForm(false);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    await api(`/api/schedules/${id}`, { method: 'DELETE' });
    load();
  };

  const toggleEnabled = async (s: Schedule) => {
    await api(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    load();
  };

  const fmtTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${m} ${hour < 12 ? 'AM' : 'PM'}`;
  };

  const fmtDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)} min`;
    return `${secs / 3600} hr`;
  };

  const fmtDays = (days: number[]) => {
    if (days.length === 7) return 'Every day';
    if (JSON.stringify(days) === JSON.stringify([1,2,3,4,5])) return 'Weekdays';
    if (JSON.stringify(days) === JSON.stringify([6,7])) return 'Weekends';
    return days.map(d => DAYS[d-1]?.full).join(', ');
  };

  return (
    <AppShell>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:'#1f2937', letterSpacing:'-0.02em' }}>
            💧 Schedules
          </div>
          <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
            Automate daily watering
          </div>
        </div>
        <button onClick={() => { setShowForm(!showForm); setErr(null); }} style={{
          padding:'9px 16px', borderRadius:12, border:'none',
          background: showForm ? '#f3f4f6' : 'linear-gradient(135deg,#10b981,#059669)',
          color: showForm ? '#6b7280' : '#fff',
          fontSize:13, fontWeight:700, cursor:'pointer',
          boxShadow: showForm ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
          transition:'all 0.2s',
        }}>
          {showForm ? '✕ Cancel' : '+ Add Schedule'}
        </button>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <form onSubmit={submit} style={{
          background:'#fff', borderRadius:20, padding:20, marginBottom:20,
          boxShadow:'0 8px 32px rgba(0,0,0,0.1)', border:'1.5px solid #e5e7eb',
          animation:'slideUp 0.3s ease',
        }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#1f2937', marginBottom:16 }}>
            🗓 New Watering Schedule
          </div>

          {err && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:12 }}>
              ⚠️ {err}
            </div>
          )}

          {/* Device */}
          {devices.length > 1 && (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
                Device
              </label>
              <select value={form.device_id} onChange={e => setForm({ ...form, device_id: e.target.value })}
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:14, color:'#1f2937', background:'#f9fafb', outline:'none' }} required>
                {devices.map(d => <option key={d.id} value={d.id}>{d.device_name}</option>)}
              </select>
            </div>
          )}

          {/* Valve */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
              Output
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {['valve1','valve2','valve3','relay1'].map(v => (
                <button type="button" key={v} onClick={() => setForm({ ...form, zone_or_output: v })} style={{
                  padding:'10px 8px', borderRadius:10, border:`1.5px solid ${form.zone_or_output===v ? '#10b981' : '#e5e7eb'}`,
                  background: form.zone_or_output===v ? '#ecfdf5' : '#f9fafb',
                  color: form.zone_or_output===v ? '#065f46' : '#6b7280',
                  fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
                }}>
                  {VALVE_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
              Start Time
            </label>
            <input type="time" value={form.start_time}
              onChange={e => setForm({ ...form, start_time: e.target.value })}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:18, fontWeight:700, color:'#1f2937', background:'#f9fafb', outline:'none', textAlign:'center' }} required />
          </div>

          {/* Duration presets */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
              Duration
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {DURATION_PRESETS.map(p => (
                <button type="button" key={p.secs} onClick={() => setForm({ ...form, duration_seconds: p.secs })} style={{
                  padding:'10px 4px', borderRadius:10,
                  border:`1.5px solid ${form.duration_seconds===p.secs ? '#10b981' : '#e5e7eb'}`,
                  background: form.duration_seconds===p.secs ? '#ecfdf5' : '#f9fafb',
                  color: form.duration_seconds===p.secs ? '#065f46' : '#6b7280',
                  fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Days */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Repeat
              </label>
              <div style={{ display:'flex', gap:6 }}>
                {[['Every day', setAllDays], ['Weekdays', setWeekdays], ['Weekend', setWeekend]].map(([label, fn]: any) => (
                  <button type="button" key={label as string} onClick={fn} style={{
                    fontSize:10, padding:'3px 8px', borderRadius:8, border:'1px solid #e5e7eb',
                    background:'#f9fafb', color:'#6b7280', cursor:'pointer', fontWeight:600,
                  }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
              {DAYS.map(d => {
                const active = form.days_of_week.includes(d.v);
                return (
                  <button type="button" key={d.v} onClick={() => toggleDay(d.v)} style={{
                    padding:'10px 0', borderRadius:10, border:'none',
                    background: active ? 'linear-gradient(135deg,#10b981,#059669)' : '#f3f4f6',
                    color: active ? '#fff' : '#6b7280',
                    fontSize:12, fontWeight:700, cursor:'pointer',
                    boxShadow: active ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
                    transition:'all 0.15s',
                  }}>{d.l}</button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={saving || form.days_of_week.length === 0} style={{
            width:'100%', padding:'14px 0', borderRadius:12, border:'none',
            background: saving ? '#d1fae5' : 'linear-gradient(135deg,#10b981,#059669)',
            color: '#fff', fontSize:14, fontWeight:800, cursor: saving ? 'default' : 'pointer',
            boxShadow:'0 4px 16px rgba(16,185,129,0.35)', transition:'all 0.2s',
          }}>
            {saving ? 'Saving…' : `Save Schedule — ${fmtTime(form.start_time)} · ${fmtDuration(form.duration_seconds)}`}
          </button>
        </form>
      )}

      {/* ── Schedule list ── */}
      {schedules.length === 0 && !showForm ? (
        <div style={{
          background:'#f9fafb', borderRadius:20, padding:'40px 24px',
          textAlign:'center', border:'2px dashed #e5e7eb',
        }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⏰</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#374151', marginBottom:6 }}>No schedules yet</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginBottom:16 }}>
            Set up automatic daily watering and never forget again.
          </div>
          <button onClick={() => setShowForm(true)} style={{
            padding:'10px 24px', borderRadius:12, border:'none',
            background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff',
            fontSize:13, fontWeight:700, cursor:'pointer',
            boxShadow:'0 4px 14px rgba(16,185,129,0.35)',
          }}>+ Add your first schedule</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {schedules.map(s => (
            <div key={s.id} style={{
              background:'#fff', borderRadius:16, padding:'14px 16px',
              border:`1.5px solid ${s.enabled ? '#6ee7b7' : '#e5e7eb'}`,
              boxShadow: s.enabled ? '0 4px 16px rgba(16,185,129,0.12)' : '0 2px 8px rgba(0,0,0,0.05)',
              transition:'all 0.3s', animation:'fadeIn 0.3s ease',
            }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <div style={{
                      fontSize:22, width:40, height:40, borderRadius:12,
                      background: s.enabled ? '#ecfdf5' : '#f3f4f6',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      filter: s.enabled ? 'none' : 'grayscale(1)',
                    }}>
                      {VALVE_LABELS[s.zone_or_output]?.split(' ')[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:20, color: s.enabled ? '#065f46' : '#6b7280', letterSpacing:'-0.02em' }}>
                        {fmtTime(s.start_time)}
                      </div>
                      <div style={{ fontSize:12, color:'#9ca3af', marginTop:1 }}>
                        {VALVE_LABELS[s.zone_or_output]?.replace(/^\S+\s/, '')} · {fmtDuration(s.duration_seconds)}
                      </div>
                    </div>
                  </div>
                  {/* Day pills */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                    {s.days_of_week.length === 7 ? (
                      <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background: s.enabled ? '#d1fae5' : '#f3f4f6', color: s.enabled ? '#065f46' : '#9ca3af', fontWeight:700 }}>
                        Every day
                      </span>
                    ) : s.days_of_week.map(d => (
                      <span key={d} style={{ fontSize:11, padding:'3px 8px', borderRadius:8, background: s.enabled ? '#d1fae5' : '#f3f4f6', color: s.enabled ? '#065f46' : '#9ca3af', fontWeight:700 }}>
                        {DAYS[d-1]?.full}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Toggle + delete */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
                  {/* Enabled toggle */}
                  <button onClick={() => toggleEnabled(s)} style={{
                    position:'relative', width:48, height:26, borderRadius:13, border:'none',
                    cursor:'pointer', flexShrink:0,
                    background: s.enabled ? 'linear-gradient(135deg,#10b981,#059669)' : '#d1d5db',
                    boxShadow: s.enabled ? '0 0 10px rgba(16,185,129,0.4)' : 'none',
                    transition:'all 0.25s',
                  }}>
                    <span style={{
                      position:'absolute', top:3, left: s.enabled ? 25 : 3,
                      width:20, height:20, borderRadius:'50%',
                      background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
                      transition:'left 0.25s cubic-bezier(.34,1.4,.64,1)',
                    }}/>
                  </button>
                  <button onClick={() => del(s.id)} style={{
                    fontSize:11, color:'#ef4444', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:'2px 4px',
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
