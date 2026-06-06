'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Device } from '@/lib/types';

function DeviceSkeleton() {
  return (
    <div style={{ background:'#fff', borderRadius:20, padding:'16px 18px', border:'1.5px solid #f1f5f9', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div className="shimmer" style={{ width:50, height:50, borderRadius:16, flexShrink:0 }}/>
        <div style={{ flex:1 }}>
          <div className="shimmer" style={{ width:'55%', height:16, borderRadius:8, marginBottom:8 }}/>
          <div className="shimmer" style={{ width:'35%', height:12, borderRadius:6 }}/>
        </div>
        <div className="shimmer" style={{ width:64, height:26, borderRadius:20 }}/>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { devices } = await api<{ devices: Device[] }>('/api/devices');
      setDevices(devices);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const online  = devices.filter(d => d.status === 'online').length;
  const offline = devices.length - online;

  return (
    <AppShell>
      <style>{`
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(0.85)} }
        .device-row { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .device-row:active { transform: scale(0.98); }
      `}</style>

      {/* ── Page header ── */}
      <div className="anim-fade-up" style={{ marginBottom:20 }}>
        <div style={{
          background:'linear-gradient(135deg,#064e3b 0%,#065f46 60%,#047857 100%)',
          borderRadius:24, padding:'20px 22px', color:'#fff',
          boxShadow:'0 8px 28px rgba(6,78,59,0.45)',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', top:-30, right:-30, width:130, height:130, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
          <div style={{ position:'absolute', bottom:-40, left:-10, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', position:'relative' }}>
            <div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>My Devices</div>
              <div style={{ fontSize:30, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 }}>📡 {devices.length}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.65)', marginTop:4 }}>irrigation controllers</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7, alignItems:'flex-end' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background:'rgba(52,211,153,0.2)', border:'1px solid rgba(52,211,153,0.3)' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 6px #34d399', animation:'pulseDot 2s infinite' }}/>
                <span style={{ fontSize:12, fontWeight:700 }}>{online} Online</span>
              </div>
              {offline > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,0.5)' }}/>
                  <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>{offline} Offline</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Device list ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {loading ? (
          <><DeviceSkeleton/><DeviceSkeleton/></>
        ) : devices.length === 0 ? (
          <div className="anim-fade-up" style={{
            background:'#fff', borderRadius:24, padding:'44px 28px', textAlign:'center',
            border:'2px dashed #e2e8f0',
          }}>
            <div style={{ fontSize:52, marginBottom:14 }}>📡</div>
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b', marginBottom:6, letterSpacing:'-0.02em' }}>No devices yet</div>
            <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.6 }}>Contact your administrator<br/>to add an Eptoflow device</div>
          </div>
        ) : devices.map((d, i) => (
          <Link key={d.id} href={`/device?id=${d.id}`} style={{ textDecoration:'none' }}>
            <div className="device-row anim-fade-up" style={{
              background:'#fff', borderRadius:20, padding:'16px 18px',
              border:`1.5px solid ${d.status==='online' ? '#bbf7d0' : '#f1f5f9'}`,
              boxShadow: d.status==='online' ? '0 4px 16px rgba(5,150,105,0.10)' : '0 2px 8px rgba(0,0,0,0.05)',
              display:'flex', alignItems:'center', gap:14,
              animationDelay:`${i*0.06}s`,
            }}>
              {/* Icon */}
              <div style={{
                width:50, height:50, borderRadius:16, flexShrink:0,
                background: d.status==='online' ? 'linear-gradient(135deg,#059669,#047857)' : '#f1f5f9',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:24,
                boxShadow: d.status==='online' ? '0 4px 14px rgba(5,150,105,0.35)' : 'none',
              }}>
                {d.status==='online' ? '💧' : '😴'}
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:15, color:'#1e293b', letterSpacing:'-0.02em', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {d.device_name}
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{d.device_uid}</div>
                <div style={{ fontSize:11, color:'#cbd5e1', marginTop:1, textTransform:'capitalize' }}>{d.plan_bound} plan</div>
              </div>
              {/* Status + chevron */}
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:20, background: d.status==='online' ? '#dcfce7' : '#f3f4f6' }}>
                  <div style={{
                    width:7, height:7, borderRadius:'50%',
                    background: d.status==='online' ? '#059669' : '#9ca3af',
                    boxShadow: d.status==='online' ? '0 0 0 3px rgba(5,150,105,0.2)' : 'none',
                    animation: d.status==='online' ? 'pulseDot 2s infinite' : 'none',
                  }}/>
                  <span style={{ fontSize:11, fontWeight:700, color: d.status==='online' ? '#059669' : '#9ca3af', textTransform:'capitalize' }}>
                    {d.status}
                  </span>
                </div>
                <div style={{ color:'#cbd5e1', fontSize:20, fontWeight:300, lineHeight:1 }}>›</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ height:16 }}/>
    </AppShell>
  );
}
