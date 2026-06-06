'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';

function notifMeta(type: string) {
  if (type === 'moisture_low')   return { icon:'💧', color:'#0284c7', bg:'#e0f2fe',  label:'Low Moisture' };
  if (type === 'moisture_high')  return { icon:'🌊', color:'#0284c7', bg:'#e0f2fe',  label:'High Moisture' };
  if (type === 'temp_high')      return { icon:'🌡️', color:'#dc2626', bg:'#fef2f2',  label:'High Temperature' };
  if (type === 'sensor_offline') return { icon:'📡', color:'#94a3b8', bg:'#f1f5f9',  label:'Sensor Offline' };
  if (type === 'relay_request')  return { icon:'⚡', color:'#7c3aed', bg:'#f5f3ff',  label:'Relay Request' };
  if (type === 'schedule')       return { icon:'⏰', color:'#059669', bg:'#f0fdf4',  label:'Schedule' };
  return                                { icon:'🔔', color:'#d97706', bg:'#fffbeb',  label:'Alert' };
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
}

export default function NotificationsPage() {
  const [items, setItems]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await api<{ notifications: Notification[] }>('/api/notifications');
      setItems(r.notifications);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api('/api/notifications/read-all', { method:'POST' });
    load();
  };

  const unread = items.filter(n => !n.is_read).length;

  return (
    <AppShell>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        .notif-item { transition: transform 0.15s, opacity 0.15s; }
        .notif-item:active { transform: scale(0.98); }
      `}</style>

      {/* ── Header ── */}
      <div className="anim-fade-up" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:'#0f172a', letterSpacing:'-0.03em' }}>
              🔔 Alerts
            </div>
            {unread > 0 && (
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:3, fontWeight:500 }}>
                {unread} unread notification{unread > 1 ? 's' : ''}
              </div>
            )}
          </div>
          {unread > 0 && (
            <button onClick={markAll} style={{
              padding:'8px 16px', borderRadius:12, border:'none',
              background:'linear-gradient(135deg,#059669,#047857)',
              color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer',
              boxShadow:'0 4px 12px rgba(5,150,105,0.3)',
            }}>
              ✓ Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => (
            <div key={i} className="shimmer" style={{ height:82, borderRadius:18 }}/>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="anim-fade-up" style={{
          background:'#fff', borderRadius:24, padding:'48px 28px', textAlign:'center',
          border:'2px dashed #e2e8f0',
        }}>
          <div style={{ fontSize:52, marginBottom:14 }}>🔔</div>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b', marginBottom:6, letterSpacing:'-0.02em' }}>All clear!</div>
          <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.6 }}>No notifications yet.<br/>You'll be alerted here when something happens.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {items.map((n, i) => {
            const meta = notifMeta(n.type);
            return (
              <div
                key={n.id}
                className="notif-item anim-fade-up"
                style={{
                  background: n.is_read ? '#fff' : `${meta.bg}`,
                  borderRadius:18, padding:'14px 16px',
                  border:`1.5px solid ${n.is_read ? '#f1f5f9' : `${meta.color}30`}`,
                  boxShadow: n.is_read ? '0 1px 4px rgba(0,0,0,0.04)' : `0 4px 14px ${meta.color}18`,
                  display:'flex', alignItems:'flex-start', gap:12,
                  opacity: n.is_read ? 0.72 : 1,
                  animationDelay:`${i*0.04}s`,
                  position:'relative',
                }}
              >
                {/* Unread indicator */}
                {!n.is_read && (
                  <div style={{
                    position:'absolute', top:14, right:14,
                    width:8, height:8, borderRadius:'50%',
                    background: meta.color,
                    boxShadow:`0 0 0 3px ${meta.color}30`,
                  }}/>
                )}

                {/* Icon */}
                <div style={{
                  width:44, height:44, borderRadius:14, flexShrink:0,
                  background: n.is_read ? '#f1f5f9' : meta.bg,
                  border:`1px solid ${meta.color}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:22,
                  filter: n.is_read ? 'grayscale(0.4)' : 'none',
                }}>
                  {meta.icon}
                </div>

                {/* Content */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                    <div style={{ fontSize:13, fontWeight:800, color: n.is_read ? '#64748b' : '#1e293b', letterSpacing:'-0.01em' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize:10, color:'#94a3b8', fontWeight:500, flexShrink:0, marginLeft:8 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  <div style={{ fontSize:12, color: n.is_read ? '#94a3b8' : '#475569', lineHeight:1.5, marginBottom:4 }}>
                    {n.message}
                  </div>
                  <div style={{
                    display:'inline-block', fontSize:10, fontWeight:700,
                    color: meta.color, background: n.is_read ? '#f1f5f9' : meta.bg,
                    padding:'2px 8px', borderRadius:20,
                    textTransform:'uppercase', letterSpacing:'0.05em',
                  }}>
                    {meta.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ height:16 }}/>
    </AppShell>
  );
}
