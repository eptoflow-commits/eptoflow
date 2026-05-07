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
    icon: '🪴',
    color: '#059669',
    dark: '#047857',
    glow: 'rgba(5,150,105,0.4)',
    glassBg: 'rgba(236,253,245,0.7)',
    border: 'rgba(52,211,153,0.5)',
    features: [
      'Daily Water Plants control',
      'Motor or Light control',
      'Manual & scheduled watering',
      'Remote access from anywhere',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹499',
    period: '/year',
    icon: '🌟',
    color: '#7c3aed',
    dark: '#6d28d9',
    glow: 'rgba(124,58,237,0.45)',
    glassBg: 'rgba(245,243,255,0.75)',
    border: 'rgba(167,139,250,0.6)',
    badge: 'Most Popular',
    features: [
      'All 3 plant zones',
      'Motor or Light control',
      'Soil moisture sensor',
      'Voice control',
      'Smart automation',
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    price: 'Talk to us',
    period: '',
    icon: '⚙️',
    color: '#b45309',
    dark: '#92400e',
    glow: 'rgba(180,83,9,0.35)',
    glassBg: 'rgba(255,251,235,0.7)',
    border: 'rgba(251,191,36,0.5)',
    features: [
      'Tailored to your setup',
      'Multiple devices & zones',
      'Priority support',
      'Custom integrations',
    ],
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
    if (!selectedPlan) return;
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim()) {
      setErr('Please fill in all required fields.'); return;
    }
    setSaving(true); setErr('');
    try {
      await api('/api/contact', {
        method: 'POST', auth: 'none',
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          plan: selectedPlan,
          message: form.message.trim() || undefined,
        }),
      });
      setDone(true);
    } catch (e: any) { setErr(e.message || 'Something went wrong. Please try again.'); }
    finally { setSaving(false); }
  };

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg,#0a1628 0%,#0f2d1f 50%,#1a1040 100%)',
        padding: 24,
      }}>
        <style>{`
          @keyframes floatUp { 0%{opacity:0;transform:translateY(30px)} 100%{opacity:1;transform:translateY(0)} }
          @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        `}</style>
        <div style={{ textAlign: 'center', maxWidth: 380, animation: 'floatUp 0.6s ease' }}>
          <div style={{ fontSize: 72, marginBottom: 20, animation: 'pulse 2s ease infinite' }}>🎉</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 10, letterSpacing: '-0.03em' }}>
            We'll be in touch!
          </div>
          <div style={{
            fontSize: 15, color: 'rgba(255,255,255,0.65)', marginBottom: 28, lineHeight: 1.7,
          }}>
            Thanks <strong style={{ color: '#fff' }}>{form.full_name}</strong>! Your request for the{' '}
            <strong style={{ color: plan?.color }}>{plan?.name} plan</strong> is received.
            We'll reach you at <strong style={{ color: '#fff' }}>{form.phone}</strong> soon.
          </div>
          <Link href="/login" style={{
            display: 'inline-block', padding: '14px 36px', borderRadius: 50,
            background: `linear-gradient(135deg,${plan?.color},${plan?.dark})`,
            color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
            boxShadow: `0 8px 32px ${plan?.glow}`,
            letterSpacing: '-0.01em',
          }}>Back to Sign In →</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#0a1628 0%,#0f2d1f 50%,#1a1040 100%)',
      padding: '32px 16px 56px',
    }}>
      <style>{`
        @keyframes floatUp { 0%{opacity:0;transform:translateY(24px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .plan-card { transition: all 0.25s cubic-bezier(.34,1.2,.64,1); }
        .plan-card:hover { transform: translateY(-2px); }
        .submit-btn {
          background-size: 200% auto;
          transition: all 0.3s ease;
          background-image: linear-gradient(135deg, var(--c1) 0%, var(--c2) 51%, var(--c1) 100%);
        }
        .submit-btn:hover:not(:disabled) { background-position: right center; transform: translateY(-1px); }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* ── Logo ── */}
        <div style={{ textAlign: 'center', marginBottom: 32, animation: 'floatUp 0.5s ease' }}>
          <img
            src="/logo.svg"
            alt="Eptoflow"
            style={{
              width: '100%',
              maxWidth: 320,
              height: 'auto',
              filter: 'drop-shadow(0 4px 24px rgba(6,182,212,0.35)) brightness(1.08)',
            }}
          />
          <div style={{
            marginTop: 8, fontSize: 13, fontWeight: 600,
            color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>Choose your plan to get started</div>
        </div>

        {/* ── Plan cards ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {PLANS.map((p, i) => {
            const active = selectedPlan === p.id;
            return (
              <button
                key={p.id}
                className="plan-card"
                type="button"
                onClick={() => setSelectedPlan(p.id)}
                style={{
                  textAlign: 'left', padding: '16px 18px',
                  borderRadius: 20,
                  border: `1.5px solid ${active ? p.color : 'rgba(255,255,255,0.08)'}`,
                  background: active
                    ? p.glassBg
                    : 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(16px)',
                  boxShadow: active
                    ? `0 8px 32px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.15)`
                    : '0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  position: 'relative', overflow: 'hidden',
                  animation: `floatUp ${0.4 + i * 0.1}s ease`,
                }}
              >
                {p.badge && (
                  <span style={{
                    position: 'absolute', top: 0, right: 18,
                    background: `linear-gradient(135deg,${p.color},${p.dark})`,
                    color: '#fff', fontSize: 9, fontWeight: 900,
                    padding: '4px 12px', borderRadius: '0 0 10px 10px',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    boxShadow: `0 4px 12px ${p.glow}`,
                  }}>{p.badge}</span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Radio ring */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      border: `2.5px solid ${active ? p.color : 'rgba(255,255,255,0.2)'}`,
                      background: active ? p.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: active ? `0 0 10px ${p.glow}` : 'none',
                      transition: 'all 0.2s',
                    }}>
                      {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}/>}
                    </div>
                    <span style={{ fontSize: 22 }}>{p.icon}</span>
                    <span style={{
                      fontWeight: 900, fontSize: 17,
                      color: active ? p.color : 'rgba(255,255,255,0.9)',
                      letterSpacing: '-0.02em',
                    }}>{p.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: 22, fontWeight: 900,
                      color: active ? p.color : 'rgba(255,255,255,0.9)',
                      letterSpacing: '-0.03em',
                    }}>{p.price}</span>
                    {p.period && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{p.period}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', paddingLeft: 34 }}>
                  {p.features.map(f => (
                    <span key={f} style={{
                      fontSize: 12,
                      color: active ? p.color : 'rgba(255,255,255,0.45)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ color: active ? p.color : 'rgba(255,255,255,0.2)', fontWeight: 700 }}>✓</span>
                      {f}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Contact form ── */}
        {selectedPlan && (
          <form onSubmit={submit} style={{
            borderRadius: 24,
            border: `1.5px solid ${plan?.border}`,
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
            padding: 22,
            animation: 'floatUp 0.3s ease',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 16, letterSpacing: '-0.02em' }}>
              {plan?.icon} Your Details — {plan?.name} Plan
            </div>

            {err && (
              <div style={{
                background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#fca5a5', marginBottom: 12,
              }}>⚠️ {err}</div>
            )}

            {[
              { key: 'full_name', label: 'Full Name',  placeholder: 'Your name',        type: 'text'  },
              { key: 'email',     label: 'Email',       placeholder: 'you@example.com',  type: 'email' },
              { key: 'phone',     label: 'Phone',       placeholder: '+91 98765 43210',  type: 'tel'   },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <label style={{
                  display: 'block', fontSize: 10, fontWeight: 700,
                  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: 6,
                }}>{field.label} *</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={form[field.key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: `1.5px solid rgba(255,255,255,0.1)`,
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box',
                    caretColor: plan?.color,
                  }}
                />
              </div>
            ))}

            {selectedPlan === 'custom' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block', fontSize: 10, fontWeight: 700,
                  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: 6,
                }}>Tell us about your needs</label>
                <textarea
                  placeholder="Describe your setup, number of zones, special requirements…"
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff', fontSize: 14, outline: 'none',
                    resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* ── THE button ── */}
            <button
              type="submit"
              disabled={saving}
              className="submit-btn"
              style={{
                '--c1': plan?.color,
                '--c2': plan?.dark,
                width: '100%', padding: '16px 0', borderRadius: 50, border: 'none',
                color: '#fff', fontSize: 15, fontWeight: 900,
                cursor: saving ? 'default' : 'pointer',
                letterSpacing: '-0.01em',
                opacity: saving ? 0.7 : 1,
                boxShadow: saving ? 'none' : `0 6px 28px ${plan?.glow}, 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`,
                marginBottom: 12,
              } as any}
            >
              {saving
                ? '⏳ Sending your request…'
                : `📬 Request ${plan?.name} Plan Access →`}
            </button>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.5 }}>
              We'll contact you within 24 hours to complete your setup.
            </p>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            Already have an account?{' '}
            <span style={{ color: '#34d399', fontWeight: 700 }}>Sign in →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
