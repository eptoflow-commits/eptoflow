'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Subscription } from '@/lib/types';

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding:'12px 0', borderBottom:'1px solid #f1f5f9' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:600, color:'#1e293b', fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ subscription: Subscription | null }>('/api/subscriptions/me')
      .then(r => setSub(r.subscription))
      .finally(() => setLoading(false));
  }, []);

  const initials = user?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  const planColor = sub?.plan_name === 'premium' ? '#7c3aed' : sub?.plan_name === 'standard' ? '#0284c7' : '#059669';
  const planBg    = sub?.plan_name === 'premium' ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : sub?.plan_name === 'standard' ? 'linear-gradient(135deg,#0284c7,#0369a1)' : 'linear-gradient(135deg,#059669,#047857)';

  return (
    <AppShell>
      <style>{`
        @keyframes avatarIn { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.05)} 100%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── Avatar hero ── */}
      <div className="anim-fade-up" style={{ textAlign:'center', marginBottom:24 }}>
        {/* Avatar circle */}
        <div style={{ display:'inline-flex', position:'relative', marginBottom:14 }}>
          <div style={{
            width:88, height:88, borderRadius:'50%',
            background: 'linear-gradient(135deg,#059669,#047857)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:30, fontWeight:900, color:'#fff', letterSpacing:'-0.02em',
            boxShadow:'0 8px 28px rgba(5,150,105,0.4)',
            animation:'avatarIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            {initials}
          </div>
          {sub?.isActive && (
            <div style={{
              position:'absolute', bottom:2, right:2,
              width:26, height:26, borderRadius:'50%',
              background: planBg,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:13, border:'2.5px solid #f5f8f5',
              boxShadow:'0 2px 8px rgba(0,0,0,0.15)',
            }}>
              ✨
            </div>
          )}
        </div>
        <div style={{ fontSize:20, fontWeight:900, color:'#0f172a', letterSpacing:'-0.03em', marginBottom:4 }}>
          {user?.full_name}
        </div>
        <div style={{ fontSize:13, color:'#94a3b8', fontWeight:500 }}>{user?.email}</div>
      </div>

      {/* ── Account info ── */}
      <div className="anim-fade-up delay-1" style={{
        background:'#fff', borderRadius:20, padding:'4px 18px 4px',
        border:'1.5px solid #f1f5f9', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:14,
      }}>
        <InfoRow label="Full name"      value={user?.full_name ?? '—'} />
        <InfoRow label="Email address"  value={user?.email    ?? '—'} />
        {user?.phone && <InfoRow label="Phone" value={user.phone} mono />}
        <InfoRow label="Account role"   value={user?.role === 'admin' ? '👑 Administrator' : '🪴 User'} />
      </div>

      {/* ── Subscription card ── */}
      <div className="anim-fade-up delay-2" style={{ marginBottom:14 }}>
        {loading ? (
          <div className="shimmer" style={{ height:110, borderRadius:20 }}/>
        ) : sub?.isActive ? (
          <div style={{
            background: planBg,
            borderRadius:20, padding:'18px 20px', color:'#fff',
            boxShadow:`0 8px 28px ${planColor}55`,
            position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', right:-20, top:-20, width:110, height:110, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }}/>
            <div style={{ position:'absolute', right:30, bottom:-30, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative' }}>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700, marginBottom:3 }}>Active Plan</div>
                <div style={{ fontSize:22, fontWeight:900, letterSpacing:'-0.03em', textTransform:'capitalize', marginBottom:2 }}>
                  {sub.plan_name} ✨
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>
                  Expires {new Date(sub.end_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:40, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 }}>{sub.daysRemaining}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)' }}>days left</div>
              </div>
            </div>
            <div style={{ marginTop:12, background:'rgba(255,255,255,0.2)', borderRadius:99, height:5, overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:99, background:'rgba(255,255,255,0.9)',
                width:`${Math.min(100, ((sub.daysRemaining ?? 0)/30)*100)}%`,
                transition:'width 1s ease',
              }}/>
            </div>
          </div>
        ) : (
          <div style={{
            background:'linear-gradient(135deg,#fffbeb,#fef3c7)',
            borderRadius:20, padding:'16px 18px',
            border:'1.5px solid #fcd34d',
            boxShadow:'0 4px 16px rgba(251,191,36,0.2)',
            display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={{ fontSize:32 }}>⚡</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, color:'#92400e', fontSize:14 }}>No active subscription</div>
              <div style={{ fontSize:12, color:'#b45309', marginTop:2 }}>Activate a plan to unlock all features</div>
            </div>
            <Link href="/subscription" style={{
              padding:'9px 14px', borderRadius:12,
              background:'linear-gradient(135deg,#d97706,#b45309)',
              color:'#fff', fontWeight:800, fontSize:12, textDecoration:'none',
              boxShadow:'0 4px 12px rgba(217,119,6,0.3)', flexShrink:0,
            }}>Upgrade →</Link>
          </div>
        )}
      </div>

      {/* ── Quick links ── */}
      <div className="anim-fade-up delay-3" style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {[
          { icon:'📡', label:'My Devices',        href:'/devices',      color:'#059669' },
          { icon:'⏰', label:'Watering Schedules', href:'/schedules',    color:'#0284c7' },
          { icon:'🔔', label:'Notifications',      href:'/notifications',color:'#7c3aed' },
          { icon:'💳', label:'Subscription Plan',  href:'/subscription', color:'#d97706' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ textDecoration:'none' }}>
            <div style={{
              background:'#fff', borderRadius:16, padding:'13px 16px',
              border:'1.5px solid #f1f5f9', boxShadow:'0 2px 6px rgba(0,0,0,0.04)',
              display:'flex', alignItems:'center', gap:14,
              transition:'transform 0.15s, box-shadow 0.15s',
            }}>
              <div style={{
                width:40, height:40, borderRadius:12, flexShrink:0,
                background:`${item.color}18`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20,
              }}>
                {item.icon}
              </div>
              <div style={{ flex:1, fontWeight:700, fontSize:14, color:'#1e293b' }}>{item.label}</div>
              <div style={{ color:'#cbd5e1', fontSize:20, fontWeight:300, lineHeight:1 }}>›</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ height:16 }}/>
    </AppShell>
  );
}
