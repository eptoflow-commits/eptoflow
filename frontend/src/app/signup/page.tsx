'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '₹249',
    period: '/year',
    emoji: '🪴',
    color: '#059669',
    dark: '#047857',
    glow: 'rgba(5,150,105,0.5)',
    activeBorder: '#34d399',
    features: ['Daily Water Plants','Motor or Light','Remote access'],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '₹349',
    period: '/year',
    emoji: '📅',
    color: '#0284c7',
    dark: '#0369a1',
    glow: 'rgba(2,132,199,0.5)',
    activeBorder: '#38bdf8',
    badge: 'Best Value',
    features: ['Daily Water Plants','Motor or Light','Scheduled watering','Remote access'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹499',
    period: '/year',
    emoji: '🌟',
    color: '#7c3aed',
    dark: '#6d28d9',
    glow: 'rgba(124,58,237,0.55)',
    activeBorder: '#a78bfa',
    badge: 'Most Popular',
    features: ['All 3 plant zones','Motor or Light','Soil moisture sensor','Voice control','Smart automation'],
  },
  {
    id: 'custom',
    name: 'Custom',
    price: 'Talk to us',
    period: '',
    emoji: '⚙️',
    color: '#b45309',
    dark: '#92400e',
    glow: 'rgba(180,83,9,0.45)',
    activeBorder: '#fbbf24',
    features: ['Tailored to your setup','Multiple devices','Priority support','Custom integrations'],
  },
];

export default function SignupPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [form, setForm]   = useState({ full_name: '', email: '', phone: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [done, setDone]   = useState(false);
  const [err, setErr]     = useState('');

  const plan = PLANS.find(p => p.id === selectedPlan);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim()) {
      setErr('Please fill in all required fields.'); return;
    }
    setSaving(true); setErr('');
    try {
      await api('/api/contact', {
        method: 'POST', auth: 'none',
        body: JSON.stringify({
          full_name: form.full_name.trim(), email: form.email.trim(),
          phone: form.phone.trim(), plan: selectedPlan!,
          message: form.message.trim() || undefined,
        }),
      });
      setDone(true);
    } catch (e: any) { setErr(e.message || 'Something went wrong.'); }
    finally { setSaving(false); }
  };

  /* ── Success screen ── */
  if (done) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#f8fafc', padding:24 }}>
      <div style={{ textAlign:'center', maxWidth:360 }}>
        <div style={{ fontSize:80, marginBottom:20 }}>🎉</div>
        <div style={{ fontSize:26, fontWeight:900, color:'#0f172a', marginBottom:10, letterSpacing:'-0.03em' }}>
          We'll be in touch!
        </div>
        <div style={{ fontSize:15, color:'#64748b', marginBottom:28, lineHeight:1.7 }}>
          Thanks <strong style={{ color:'#0f172a' }}>{form.full_name}</strong>! Your{' '}
          <strong style={{ color: plan?.color }}>{plan?.name} plan</strong> request is received.
          We'll call you at <strong style={{ color:'#0f172a' }}>{form.phone}</strong> shortly.
        </div>
        <Link href="/login" style={{
          display:'inline-block', padding:'14px 36px', borderRadius:50,
          background:`linear-gradient(135deg,${plan?.color},${plan?.dark})`,
          color:'#fff', fontWeight:800, fontSize:15, textDecoration:'none',
          boxShadow:`0 8px 28px ${plan?.glow}`,
        }}>Back to Sign In →</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', padding:'0 0 56px' }}>
      <style>{`
        @keyframes rise { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bgShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        .plan-pick { cursor:pointer; transition:transform 0.2s, box-shadow 0.2s; }
        .plan-pick:hover { transform:translateY(-3px); }
        .glow-btn {
          background-size:200% auto;
          transition:background-position 0.4s ease, transform 0.15s ease, box-shadow 0.2s;
          background-image:linear-gradient(135deg,var(--c1) 0%,var(--c2) 50%,var(--c1) 100%);
        }
        .glow-btn:not(:disabled):hover { background-position:right center; transform:translateY(-2px); }
        .glow-btn:not(:disabled):active { transform:translateY(0) scale(0.98); }
        input[type=text],input[type=email],input[type=tel],textarea {
          width:100%; padding:12px 14px; border-radius:12px;
          border:1.5px solid #e2e8f0; font-size:14px; color:#0f172a;
          background:#fff; outline:none; box-sizing:border-box;
          transition:border-color 0.15s;
        }
        input:focus,textarea:focus { border-color:#94a3b8; }
      `}</style>

      {/* ══════════════════════════════════
          LOGO HERO — white card, full width
          ══════════════════════════════════ */}
      <div style={{
        background:'#ffffff',
        padding:'32px 24px 24px',
        boxShadow:'0 1px 0 #e2e8f0, 0 8px 32px rgba(0,0,0,0.06)',
        animation:'rise 0.5s ease',
        marginBottom:24,
      }}>
        {/* The actual logo — full width, no restriction */}
        <img
          src="/logo.jpeg"
          alt="Eptoflow"
          style={{
            display:'block',
            width:'100%',
            maxWidth:520,
            height:'auto',
            margin:'0 auto',
          }}
        />
        <div style={{
          textAlign:'center', marginTop:16,
          fontSize:13, fontWeight:700, color:'#64748b',
          letterSpacing:'0.1em', textTransform:'uppercase',
        }}>
          Select a plan to get started
        </div>
      </div>

      <div style={{ maxWidth:480, margin:'0 auto', padding:'0 16px' }}>

        {/* ── Plan cards ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
          {PLANS.map((p, i) => {
            const active = selectedPlan === p.id;
            return (
              <div key={p.id} className="plan-pick"
                onClick={() => setSelectedPlan(p.id)}
                style={{
                  borderRadius:20, padding:'18px 20px',
                  background: active ? '#fff' : '#fff',
                  border: active ? `2.5px solid ${p.color}` : '2px solid #e2e8f0',
                  boxShadow: active
                    ? `0 0 0 4px ${p.color}18, 0 12px 36px ${p.glow}`
                    : '0 2px 8px rgba(0,0,0,0.04)',
                  position:'relative', overflow:'hidden',
                  animation:`rise ${0.3 + i*0.1}s ease`,
                }}
              >
                {/* Popular badge */}
                {p.badge && (
                  <div style={{
                    position:'absolute', top:0, right:20,
                    background:`linear-gradient(135deg,${p.color},${p.dark})`,
                    color:'#fff', fontSize:9, fontWeight:900, letterSpacing:'0.1em',
                    padding:'5px 14px', borderRadius:'0 0 12px 12px',
                    boxShadow:`0 4px 14px ${p.glow}`,
                    textTransform:'uppercase',
                  }}>{p.badge}</div>
                )}

                {/* Active shimmer bar */}
                {active && (
                  <div style={{
                    position:'absolute', top:0, left:0, right:0, height:3,
                    background:`linear-gradient(90deg,${p.color},${p.activeBorder},${p.color})`,
                    backgroundSize:'200% auto',
                    animation:'bgShift 2s linear infinite',
                  }}/>
                )}

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {/* Animated radio */}
                    <div style={{
                      width:24, height:24, borderRadius:'50%', flexShrink:0,
                      border:`2.5px solid ${active ? p.color : '#cbd5e1'}`,
                      background: active ? p.color : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      boxShadow: active ? `0 0 0 4px ${p.color}20` : 'none',
                      transition:'all 0.2s',
                    }}>
                      {active && <div style={{ width:9, height:9, borderRadius:'50%', background:'#fff' }}/>}
                    </div>
                    <span style={{ fontSize:26 }}>{p.emoji}</span>
                    <div>
                      <div style={{ fontWeight:900, fontSize:18, color: active ? p.color : '#0f172a', letterSpacing:'-0.02em' }}>
                        {p.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:26, fontWeight:900, color: active ? p.color : '#0f172a', letterSpacing:'-0.03em', lineHeight:1 }}>
                      {p.price}
                    </div>
                    {p.period && <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>{p.period}</div>}
                  </div>
                </div>

                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 16px', paddingLeft:36 }}>
                  {p.features.map(f => (
                    <span key={f} style={{
                      fontSize:12, display:'flex', alignItems:'center', gap:5,
                      color: active ? p.color : '#64748b',
                      fontWeight: active ? 600 : 400,
                    }}>
                      <span style={{ fontWeight:800 }}>✓</span> {f}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Contact form ── */}
        {selectedPlan && (
          <form onSubmit={submit} style={{
            background:'#fff', borderRadius:24, padding:24,
            border:`2px solid ${plan?.color}30`,
            boxShadow:`0 0 0 6px ${plan?.color}0a, 0 16px 48px rgba(0,0,0,0.1)`,
            animation:'rise 0.25s ease',
          }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', marginBottom:18, letterSpacing:'-0.02em' }}>
              {plan?.emoji} Your Details — <span style={{ color:plan?.color }}>{plan?.name}</span>
            </div>

            {err && (
              <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:10,
                padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:12 }}>
                ⚠️ {err}
              </div>
            )}

            {[
              { key:'full_name', label:'Full Name',  placeholder:'Your name',       type:'text'  },
              { key:'email',     label:'Email',       placeholder:'you@example.com', type:'email' },
              { key:'phone',     label:'Phone',       placeholder:'+91 98765 43210', type:'tel'   },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b',
                  textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                  {f.label} *
                </label>
                <input type={f.type} placeholder={f.placeholder} required
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(v => ({ ...v, [f.key]:e.target.value }))}/>
              </div>
            ))}

            {selectedPlan === 'custom' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b',
                  textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                  Tell us what you need
                </label>
                <textarea placeholder="Describe your setup, zones, special requirements…"
                  value={form.message} rows={3}
                  onChange={e => setForm(v => ({ ...v, message:e.target.value }))}
                  style={{ resize:'vertical' }}/>
              </div>
            )}

            {/* THE premium button */}
            <button
              type="submit"
              disabled={saving}
              className="glow-btn"
              style={{
                '--c1': plan?.color,
                '--c2': plan?.dark,
                width:'100%', padding:'17px 0', marginTop:4,
                borderRadius:50, border:'none',
                color:'#fff', fontSize:16, fontWeight:900,
                letterSpacing:'-0.01em',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.75 : 1,
                boxShadow: saving ? 'none'
                  : `0 6px 0 ${plan?.dark}, 0 10px 32px ${plan?.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
              } as any}
            >
              {saving ? '⏳  Sending…' : `📬  Request ${plan?.name} Plan Access →`}
            </button>

            <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', marginTop:14, lineHeight:1.5 }}>
              We'll reach you within 24 hours to complete your setup.
            </p>
          </form>
        )}

        <div style={{ textAlign:'center', marginTop:24 }}>
          <Link href="/login" style={{ fontSize:13, color:'#64748b', textDecoration:'none' }}>
            Already have an account?{' '}
            <span style={{ color:'#059669', fontWeight:700 }}>Sign in →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
