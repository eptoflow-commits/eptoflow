'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Subscription } from '@/lib/types';

const PLAN_ORDER: Record<string, number> = { basic: 1, standard: 2, premium: 3 };

const PLANS = [
  {
    id: 'basic',
    label: 'Basic',
    price: '₹249',
    period: '/month',
    emoji: '🪴',
    color: '#059669', dark: '#047857', glow: 'rgba(5,150,105,0.35)',
    features: ['Daily Water Plants', 'Motor or Light', 'Push notifications', 'Remote access'],
  },
  {
    id: 'standard',
    label: 'Standard',
    price: '₹349',
    period: '/month',
    emoji: '🕐',
    color: '#0284c7', dark: '#0369a1', glow: 'rgba(2,132,199,0.35)',
    features: ['Daily Water Plants', 'Motor or Light', 'Scheduled watering', 'Weekly reports', 'Remote access'],
  },
  {
    id: 'premium',
    label: 'Premium',
    price: '₹499',
    period: '/month',
    emoji: '🌟',
    color: '#7c3aed', dark: '#6d28d9', glow: 'rgba(124,58,237,0.35)',
    features: ['All 3 plant zones', 'Motor or Light', 'Soil moisture sensor', 'Voice control', 'Weather-based watering', 'Smart automation', 'Water usage insights'],
  },
];

export default function SubscriptionPage() {
  const [sub, setSub]           = useState<Subscription | null | 'loading'>('loading');
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested]   = useState(false);
  const [err, setErr]           = useState('');

  useEffect(() => {
    api<{ subscription: Subscription | null }>('/api/subscriptions/me')
      .then(r => setSub(r.subscription))
      .catch(() => setSub(null));
  }, []);

  const requestUpgrade = async () => {
    setRequesting(true); setErr('');
    try {
      await api('/api/subscriptions/request-upgrade', { method: 'POST' });
      setRequested(true);
    } catch (e: any) { setErr(e.message || 'Failed to send request'); }
    finally { setRequesting(false); }
  };

  const currentPlanOrder = sub && sub !== 'loading' && sub.plan_name
    ? (PLAN_ORDER[sub.plan_name] ?? 0) : 0;
  const isActive = sub && sub !== 'loading' && (sub as Subscription).isActive;
  const currentPlan = sub && sub !== 'loading' ? PLANS.find(p => p.id === (sub as Subscription).plan_name) : null;

  return (
    <AppShell>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .plan-card { animation: fadeUp 0.4s ease both; }
      `}</style>

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:20, fontWeight:900, color:'#0f172a', letterSpacing:'-0.03em' }}>
          📋 Your Plan
        </div>
        <div style={{ fontSize:13, color:'#94a3b8', marginTop:2 }}>Contact admin to change your plan</div>
      </div>

      {/* ── Current plan hero (if active) ── */}
      {isActive && currentPlan && (
        <div className="plan-card" style={{
          borderRadius:22,
          background:`linear-gradient(135deg,${currentPlan.color},${currentPlan.dark})`,
          padding:'20px 22px', marginBottom:20, color:'#fff',
          boxShadow:`0 8px 28px ${currentPlan.glow}`,
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }}/>
          <div style={{ position:'absolute', right:30, bottom:-40, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700, marginBottom:4 }}>
              ✅ Active Plan
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ fontSize:32 }}>{currentPlan.emoji}</span>
              <div>
                <div style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.03em' }}>{currentPlan.label}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)' }}>{currentPlan.price}{currentPlan.period}</div>
              </div>
              <div style={{ marginLeft:'auto', textAlign:'right' }}>
                <div style={{ fontSize:36, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 }}>
                  {(sub as Subscription).daysRemaining}
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>days left</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:99, height:5, marginBottom:8 }}>
              <div style={{
                height:'100%', borderRadius:99, background:'rgba(255,255,255,0.9)',
                width:`${Math.min(100, (((sub as Subscription).daysRemaining ?? 0) / 30) * 100)}%`,
                boxShadow:'0 0 8px rgba(255,255,255,0.5)',
              }}/>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>
              Expires {new Date((sub as Subscription).end_date).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}
            </div>
            {/* Features */}
            <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:'6px 16px' }}>
              {currentPlan.features.map(f => (
                <span key={f} style={{ fontSize:12, color:'rgba(255,255,255,0.85)', display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ fontWeight:900 }}>✓</span> {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── No active plan ── */}
      {!isActive && sub !== 'loading' && (
        <div style={{
          borderRadius:20, padding:'16px 18px', marginBottom:20,
          background:'linear-gradient(135deg,#fffbeb,#fef3c7)',
          border:'2px solid #fcd34d',
          boxShadow:'0 4px 16px rgba(251,191,36,0.2)',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <span style={{ fontSize:36 }}>⚡</span>
          <div>
            <div style={{ fontWeight:800, color:'#92400e', fontSize:15 }}>No active plan</div>
            <div style={{ fontSize:12, color:'#b45309', marginTop:2, lineHeight:1.5 }}>
              Contact your admin or request an upgrade below to get started
            </div>
          </div>
        </div>
      )}

      {/* ── Available upgrades ── */}
      {(() => {
        const upgradable = PLANS.filter(p => PLAN_ORDER[p.id] > currentPlanOrder);
        if (upgradable.length === 0) return (
          <div style={{
            borderRadius:18, padding:'20px', textAlign:'center',
            background:'#f8fafc', border:'2px solid #e2e8f0',
          }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🏆</div>
            <div style={{ fontWeight:800, color:'#1f2937', fontSize:16, marginBottom:4 }}>
              You're on the highest plan!
            </div>
            <div style={{ fontSize:13, color:'#6b7280' }}>
              You have access to all Eptoflow features.
            </div>
          </div>
        );
        return (
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
              {currentPlanOrder > 0 ? 'Available Upgrades' : 'Choose a Plan'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {upgradable.map((p, i) => (
                <div key={p.id} className="plan-card" style={{
                  animationDelay:`${i * 0.08}s`,
                  borderRadius:20, overflow:'hidden',
                  border:`2px solid ${p.color}30`,
                  boxShadow:`0 4px 16px ${p.glow}`,
                  background:'#fff',
                }}>
                  <div style={{
                    background:`linear-gradient(135deg,${p.color},${p.dark})`,
                    padding:'14px 18px', color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:24 }}>{p.emoji}</span>
                      <div>
                        <div style={{ fontWeight:900, fontSize:17 }}>{p.label}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>Upgrade required</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:900, fontSize:22 }}>{p.price}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>{p.period}</div>
                    </div>
                  </div>
                  <div style={{ padding:'14px 18px' }}>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'5px 14px', marginBottom:14 }}>
                      {p.features.map(f => (
                        <span key={f} style={{ fontSize:12, color:'#374151', display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ color:p.color, fontWeight:900 }}>✓</span> {f}
                        </span>
                      ))}
                    </div>
                    {err && <div style={{ fontSize:12, color:'#dc2626', marginBottom:8 }}>⚠️ {err}</div>}
                    {requested ? (
                      <div style={{
                        padding:'12px', borderRadius:12, background:`${p.color}12`,
                        border:`1.5px solid ${p.color}30`, textAlign:'center',
                      }}>
                        <div style={{ fontSize:20, marginBottom:4 }}>📩</div>
                        <div style={{ fontWeight:700, color:p.color, fontSize:13 }}>Request sent! Admin will reach you soon.</div>
                      </div>
                    ) : (
                      <button onClick={requestUpgrade} disabled={requesting} style={{
                        width:'100%', padding:'13px 0', borderRadius:50, border:'none',
                        background:`linear-gradient(135deg,${p.color},${p.dark})`,
                        color:'#fff', fontWeight:800, fontSize:14, cursor: requesting ? 'not-allowed' : 'pointer',
                        boxShadow:`0 4px 0 ${p.dark}, 0 8px 20px ${p.glow}`,
                        opacity: requesting ? 0.7 : 1,
                      }}>
                        {requesting ? '⏳ Sending…' : `📬 Request ${p.label} Upgrade →`}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', marginTop:20 }}>
        Admin activates your plan within 24 hours of request.
      </p>
    </AppShell>
  );
}
