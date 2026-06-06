'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * AutomationRuleBuilder — per-valve automation threshold configuration
 * Visual redesign v2: premium rule cards, modern sliders, rich condition panels
 */

type Rule = {
  valve_key:       string;
  enabled:         boolean;
  mode:            'manual' | 'auto';
  on_moisture_lt:  number | null;
  on_temp_gt:      number | null;
  on_logic:        'AND' | 'OR';
  off_moisture_gt: number | null;
  off_temp_lt:     number | null;
  off_logic:       'AND' | 'OR';
  schedule_start:  string | null;
  schedule_end:    string | null;
  max_duration_s:  number;
};

const DEFAULT_RULE = (valveKey: string): Rule => ({
  valve_key: valveKey, enabled: true, mode: 'auto',
  on_moisture_lt: 30, on_temp_gt: null, on_logic: 'AND',
  off_moisture_gt: 60, off_temp_lt: null, off_logic: 'AND',
  schedule_start: '06:00', schedule_end: '08:00',
  max_duration_s: valveKey === 'relay6' ? 600 : 1800,
});

const VALVE_META: Record<string, { icon: string; label: string; color: string }> = {
  valve1: { icon:'🪴', label:'Daily Watering',      color:'#059669' },
  valve2: { icon:'🌿', label:'Occasional Watering', color:'#0891b2' },
  valve3: { icon:'🌊', label:'Misting',             color:'#7c3aed' },
  relay1: { icon:'⚡', label:'Motor / Light',       color:'#d97706' },
  relay6: { icon:'💊', label:'MediSpray',           color:'#e11d48' },
  relay7: { icon:'💧', label:'Extra Zone 1',        color:'#0369a1' },
  relay8: { icon:'💧', label:'Extra Zone 2',        color:'#0369a1' },
};

type Props = { deviceId: string; availableValves: string[]; zoneNames?: Record<string, string> };

export default function AutomationRuleBuilder({ deviceId, availableValves, zoneNames = {} }: Props) {
  const [rules,    setRules]    = useState<Record<string, Rule>>({});
  const [saving,   setSaving]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(availableValves[0] ?? null);
  const [msg,      setMsg]      = useState<Record<string, string>>({});

  useEffect(() => {
    api<{ rules: Rule[] }>(`/api/relays/${deviceId}/automation`)
      .then(r => {
        const map: Record<string, Rule> = {};
        for (const rule of (r?.rules ?? [])) {
          map[rule.valve_key] = { ...rule, enabled: !!rule.enabled };
        }
        setRules(map);
      })
      .catch(() => {});
  }, [deviceId]);

  const getRule    = (key: string): Rule => rules[key] ?? DEFAULT_RULE(key);
  const updateField = (key: string, field: keyof Rule, value: any) =>
    setRules(prev => ({ ...prev, [key]: { ...(prev[key] ?? DEFAULT_RULE(key)), [field]: value } }));

  const save = async (key: string) => {
    setSaving(key);
    try {
      await api<{ rule: Rule }>(`/api/relays/${deviceId}/automation/${key}`, {
        method: 'PUT', body: JSON.stringify(getRule(key)),
      });
      setMsg(m => ({ ...m, [key]: 'saved' }));
      setTimeout(() => setMsg(m => ({ ...m, [key]: '' })), 2500);
    } catch (e: any) {
      setMsg(m => ({ ...m, [key]: 'error:' + e.message }));
    } finally { setSaving(null); }
  };

  const deleteRule = async (key: string) => {
    await api(`/api/relays/${deviceId}/automation/${key}`, { method: 'DELETE' }).catch(() => {});
    setRules(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`
        @keyframes expandIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes savePop  { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        .rule-slider { -webkit-appearance:none; appearance:none; height:6px; border-radius:99px; outline:none; cursor:pointer; transition:opacity 0.15s; }
        .rule-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:20px; height:20px; border-radius:50%; background:#fff; border:2.5px solid currentColor; box-shadow:0 2px 8px rgba(0,0,0,0.2); cursor:pointer; transition:transform 0.15s; }
        .rule-slider::-webkit-slider-thumb:hover { transform:scale(1.2); }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#0f172a,#1e3a5f)',
        borderRadius: 20, padding: '16px 18px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width:40, height:40, borderRadius:13, background:'rgba(16,185,129,0.2)', border:'1px solid rgba(16,185,129,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🤖</div>
        <div>
          <div style={{ fontWeight:800, fontSize:14, letterSpacing:'-0.01em' }}>Automation Rules</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:1 }}>Device waters automatically — even offline</div>
        </div>
      </div>

      {availableValves.map(key => {
        const r      = getRule(key);
        const isOpen = expanded === key;
        const meta   = VALVE_META[key] ?? { icon:'💧', label:key, color:'#059669' };
        const label  = zoneNames[key] || meta.label;
        const isAuto = r.mode === 'auto' && r.enabled;

        return (
          <div key={key} style={{
            background: '#fff', borderRadius: 20, overflow: 'hidden',
            border: `1.5px solid ${isOpen ? meta.color + '40' : '#f1f5f9'}`,
            boxShadow: isOpen ? `0 4px 20px ${meta.color}18` : '0 2px 6px rgba(0,0,0,0.04)',
            transition: 'all 0.25s',
          }}>
            {/* Accordion header */}
            <button
              onClick={() => setExpanded(isOpen ? null : key)}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:12,
                padding:'14px 16px', background:'transparent', border:'none', cursor:'pointer',
                textAlign:'left', transition:'background 0.15s',
              }}
            >
              <div style={{
                width:40, height:40, borderRadius:13, flexShrink:0,
                background: isAuto ? `${meta.color}18` : '#f1f5f9',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
              }}>
                {meta.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:14, color:'#1e293b', letterSpacing:'-0.01em' }}>{label}</div>
                <div style={{ fontSize:11, color: isAuto ? meta.color : '#94a3b8', marginTop:1, fontWeight:600 }}>
                  {isAuto ? '🟢 Auto-watering active' : r.mode === 'manual' ? '🖐 Manual mode' : '⏸ Disabled'}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                <div style={{
                  padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:800,
                  background: isAuto ? `${meta.color}18` : '#f1f5f9',
                  color: isAuto ? meta.color : '#94a3b8',
                  textTransform:'uppercase', letterSpacing:'0.05em',
                }}>
                  {isAuto ? 'AUTO' : 'MANUAL'}
                </div>
                <div style={{
                  width:28, height:28, borderRadius:9, background: isOpen ? `${meta.color}18` : '#f8fafc',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: isOpen ? meta.color : '#94a3b8', fontSize:14,
                  transition:'all 0.2s',
                }}>
                  {isOpen ? '▲' : '▼'}
                </div>
              </div>
            </button>

            {/* Expanded body */}
            {isOpen && (
              <div style={{ padding:'0 16px 18px', animation:'expandIn 0.25s ease' }}>
                <div style={{ borderTop:`1px solid ${meta.color}20`, paddingTop:14, display:'flex', flexDirection:'column', gap:14 }}>

                  {/* Mode + enabled */}
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {/* Mode toggle */}
                    <div style={{ display:'flex', borderRadius:12, border:'1.5px solid #e2e8f0', overflow:'hidden', flex:1 }}>
                      {(['manual','auto'] as const).map(m => (
                        <button key={m} onClick={() => updateField(key,'mode',m)} style={{
                          flex:1, padding:'9px 0', border:'none', cursor:'pointer', fontSize:12, fontWeight:800,
                          background: r.mode===m ? meta.color : '#fff',
                          color: r.mode===m ? '#fff' : '#94a3b8',
                          transition:'all 0.2s',
                        }}>
                          {m==='manual' ? '🖐 Manual' : '🤖 Auto'}
                        </button>
                      ))}
                    </div>
                    {/* Enabled toggle */}
                    <button onClick={() => updateField(key,'enabled',!r.enabled)} style={{
                      position:'relative', width:50, height:28, borderRadius:14, border:'none', cursor:'pointer', flexShrink:0,
                      background: r.enabled ? meta.color : '#e2e8f0',
                      boxShadow: r.enabled ? `0 0 0 3px ${meta.color}30` : 'none',
                      transition:'all 0.25s',
                    }}>
                      <span style={{
                        position:'absolute', top:4, left: r.enabled ? 26 : 4,
                        width:20, height:20, borderRadius:'50%',
                        background:'#fff', boxShadow:'0 1px 6px rgba(0,0,0,0.25)',
                        transition:'left 0.25s cubic-bezier(0.34,1.4,0.64,1)',
                      }}/>
                    </button>
                  </div>

                  {r.mode === 'auto' && (<>

                    {/* Turn ON panel */}
                    <div style={{
                      background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',
                      border:'1.5px solid #bbf7d0', borderRadius:16, padding:'14px 14px 12px',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                        <div style={{ width:22, height:22, borderRadius:7, background:'#059669', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>💧</div>
                        <span style={{ fontSize:11, fontWeight:800, color:'#065f46', textTransform:'uppercase', letterSpacing:'0.07em' }}>Turn ON when…</span>
                      </div>
                      <ThresholdRow accentColor="#059669" label="Moisture below" unit="%" min={0} max={100} step={1} value={r.on_moisture_lt} onChange={v => updateField(key,'on_moisture_lt',v)} placeholder="30" />
                      <ThresholdRow accentColor="#dc2626" label="Temperature above" unit="°C" min={0} max={60} step={0.5} value={r.on_temp_gt} onChange={v => updateField(key,'on_temp_gt',v)} placeholder="34" />
                      {r.on_moisture_lt !== null && r.on_temp_gt !== null && (
                        <LogicToggle color="#059669" value={r.on_logic} onChange={v => updateField(key,'on_logic',v)} />
                      )}
                    </div>

                    {/* Turn OFF panel */}
                    <div style={{
                      background:'linear-gradient(135deg,#fff1f2,#ffe4e6)',
                      border:'1.5px solid #fecdd3', borderRadius:16, padding:'14px 14px 12px',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                        <div style={{ width:22, height:22, borderRadius:7, background:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>⛔</div>
                        <span style={{ fontSize:11, fontWeight:800, color:'#991b1b', textTransform:'uppercase', letterSpacing:'0.07em' }}>Turn OFF when…</span>
                      </div>
                      <ThresholdRow accentColor="#0284c7" label="Moisture above" unit="%" min={0} max={100} step={1} value={r.off_moisture_gt} onChange={v => updateField(key,'off_moisture_gt',v)} placeholder="60" />
                      <ThresholdRow accentColor="#059669" label="Temperature below" unit="°C" min={0} max={60} step={0.5} value={r.off_temp_lt} onChange={v => updateField(key,'off_temp_lt',v)} placeholder="25" />
                      {r.off_moisture_gt !== null && r.off_temp_lt !== null && (
                        <LogicToggle color="#dc2626" value={r.off_logic} onChange={v => updateField(key,'off_logic',v)} />
                      )}
                    </div>

                    {/* Schedule window */}
                    <div style={{ background:'#f8fafc', borderRadius:14, padding:'12px 14px' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>⏰ Run Window (optional)</div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <input type="time" value={r.schedule_start ?? ''} onChange={e => updateField(key,'schedule_start',e.target.value||null)}
                          style={{ flex:1, padding:'9px 10px', borderRadius:10, border:'1.5px solid #e2e8f0', fontSize:14, fontWeight:700, color:'#1e293b', background:'#fff', outline:'none', textAlign:'center' }} />
                        <div style={{ color:'#94a3b8', fontSize:16, fontWeight:300 }}>→</div>
                        <input type="time" value={r.schedule_end ?? ''} onChange={e => updateField(key,'schedule_end',e.target.value||null)}
                          style={{ flex:1, padding:'9px 10px', borderRadius:10, border:'1.5px solid #e2e8f0', fontSize:14, fontWeight:700, color:'#1e293b', background:'#fff', outline:'none', textAlign:'center' }} />
                        {(r.schedule_start || r.schedule_end) && (
                          <button onClick={() => { updateField(key,'schedule_start',null); updateField(key,'schedule_end',null); }}
                            style={{ padding:'8px 10px', borderRadius:10, border:'none', background:'#fee2e2', color:'#dc2626', fontSize:11, fontWeight:700, cursor:'pointer' }}>✕</button>
                        )}
                      </div>
                    </div>

                    {/* Max duration */}
                    <div style={{ background:'#f8fafc', borderRadius:14, padding:'12px 14px' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>⏱ Max Run Time</div>
                      {key === 'relay6' ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:10, background:'#fffbeb', border:'1.5px solid #fcd34d' }}>
                          <span style={{ fontSize:16 }}>⚠️</span>
                          <span style={{ fontSize:12, color:'#92400e', fontWeight:700 }}>10 minutes max (MediSpray safety limit)</span>
                        </div>
                      ) : (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                          {[{v:300,l:'5 min'},{v:600,l:'10 min'},{v:900,l:'15 min'},{v:1800,l:'30 min'},{v:3600,l:'1 hr'},{v:7200,l:'2 hr'}].map(p => (
                            <button key={p.v} onClick={() => updateField(key,'max_duration_s',p.v)} style={{
                              padding:'8px 0', borderRadius:10, border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
                              background: r.max_duration_s===p.v ? meta.color : '#fff',
                              color: r.max_duration_s===p.v ? '#fff' : '#64748b',
                              border: `1.5px solid ${r.max_duration_s===p.v ? meta.color : '#e2e8f0'}`,
                              boxShadow: r.max_duration_s===p.v ? `0 3px 10px ${meta.color}40` : 'none',
                              transition:'all 0.15s',
                            }}>{p.l}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>)}

                  {/* Actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <button onClick={() => save(key)} disabled={saving===key} style={{
                      flex:1, padding:'12px 0', borderRadius:13, border:'none', cursor: saving===key ? 'default' : 'pointer',
                      background: saving===key ? '#f1f5f9' : `linear-gradient(135deg,${meta.color},${meta.color}cc)`,
                      color: saving===key ? '#94a3b8' : '#fff', fontSize:13, fontWeight:800,
                      boxShadow: saving===key ? 'none' : `0 4px 14px ${meta.color}50`,
                      transition:'all 0.2s',
                    }}>
                      {saving===key ? '⏳ Saving…' : '💾 Save Rule'}
                    </button>
                    <button onClick={() => deleteRule(key)} style={{
                      padding:'12px 14px', borderRadius:13, border:'1.5px solid #fecdd3',
                      background:'#fff', color:'#ef4444', fontSize:13, fontWeight:700, cursor:'pointer',
                      transition:'all 0.15s',
                    }}>🗑</button>
                  </div>

                  {/* Save feedback */}
                  {msg[key] && (
                    <div style={{
                      padding:'10px 14px', borderRadius:12, textAlign:'center',
                      background: msg[key].startsWith('error:') ? '#fef2f2' : '#f0fdf4',
                      border: `1.5px solid ${msg[key].startsWith('error:') ? '#fecaca' : '#bbf7d0'}`,
                      fontSize:13, fontWeight:700,
                      color: msg[key].startsWith('error:') ? '#dc2626' : '#059669',
                      animation:'savePop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                    }}>
                      {msg[key].startsWith('error:') ? `⚠️ ${msg[key].replace('error:','')}` : '✅ Rule saved successfully'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function ThresholdRow({ label, unit, min, max, step, value, onChange, placeholder, accentColor }: {
  label: string; unit: string; min: number; max: number; step: number;
  value: number | null; onChange: (v: number | null) => void; placeholder: string; accentColor: string;
}) {
  const pct = value != null ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#475569' }}>{label}</span>
        {value !== null ? (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:13, fontWeight:900, color:accentColor, fontFamily:'monospace' }}>{value}{unit}</span>
            <button onClick={() => onChange(null)} style={{ width:20, height:20, borderRadius:'50%', border:'none', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>✕</button>
          </div>
        ) : (
          <button onClick={() => onChange(min + (max - min) * 0.3)} style={{
            padding:'4px 12px', borderRadius:20, border:`1.5px solid ${accentColor}40`,
            background:`${accentColor}10`, color:accentColor, fontSize:11, fontWeight:700, cursor:'pointer',
          }}>+ Set</button>
        )}
      </div>
      {value !== null && (
        <div style={{ position:'relative' }}>
          <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="rule-slider"
            style={{
              width:'100%', color:accentColor,
              background:`linear-gradient(to right, ${accentColor} ${pct}%, #e2e8f0 ${pct}%)`,
            } as any}
          />
        </div>
      )}
    </div>
  );
}

function LogicToggle({ value, onChange, color }: { value: 'AND' | 'OR'; onChange: (v: 'AND' | 'OR') => void; color: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
      <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Combine conditions:</span>
      {(['AND','OR'] as const).map(l => (
        <button key={l} onClick={() => onChange(l)} style={{
          padding:'4px 14px', borderRadius:20, border:'none', cursor:'pointer',
          background: value===l ? color : '#f1f5f9',
          color: value===l ? '#fff' : '#64748b',
          fontSize:11, fontWeight:800,
          boxShadow: value===l ? `0 2px 8px ${color}40` : 'none',
          transition:'all 0.15s',
        }}>
          {l==='AND' ? 'Both (AND)' : 'Either (OR)'}
        </button>
      ))}
    </div>
  );
}
