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
    glow: 'rgba(5,150,105,0.25)',
    bg: '#ecfdf5',
    border: '#6ee7b7',
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
    glow: 'rgba(124,58,237,0.25)',
    bg: '#f5f3ff',
    border: '#c4b5fd',
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
    price: 'Contact us',
    period: '',
    icon: '⚙️',
    color: '#d97706',
    glow: 'rgba(217,119,6,0.25)',
    bg: '#fffbeb',
    border: '#fcd34d',
    features: [
      'Tailored to your needs',
      'Multiple devices',
      'Priority support',
      'Custom integrations',
    ],
  },
];

export default function SignupPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

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
        method: 'POST',
        auth: 'none',
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          plan: selectedPlan,
          message: form.message.trim() || undefined,
        }),
      });
      setDone(true);
    } catch (e: any) {
      setErr(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#ecfdf5 0%,#fff 60%,#f5f3ff 100%)',
        padding: '24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>
            We'll be in touch!
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
            Thanks <strong>{form.full_name}</strong>! We've received your request for the{' '}
            <strong style={{ color: plan?.color }}>{plan?.name} plan</strong>.
            Our team will contact you at <strong>{form.phone}</strong> or <strong>{form.email}</strong> shortly.
          </div>
          <Link href="/login" style={{
            display: 'inline-block', padding: '12px 28px', borderRadius: 12,
            background: 'linear-gradient(135deg,#059669,#047857)',
            color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(5,150,105,0.3)',
          }}>Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#ecfdf5 0%,#fff 50%,#eff6ff 100%)',
      padding: '24px 16px 48px',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.svg" alt="Eptoflow" style={{ height: 52, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', letterSpacing: '-0.02em' }}>
            Get Started with Eptoflow
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Choose a plan and we'll set you up
          </div>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {PLANS.map(p => {
            const active = selectedPlan === p.id;
            return (
              <button key={p.id} type="button" onClick={() => setSelectedPlan(p.id)} style={{
                textAlign: 'left', padding: '14px 16px',
                borderRadius: 16,
                border: `2px solid ${active ? p.color : '#e5e7eb'}`,
                background: active ? p.bg : '#fff',
                boxShadow: active ? `0 4px 20px ${p.glow}` : '0 1px 4px rgba(0,0,0,0.05)',
                cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
              }}>
                {p.badge && (
                  <span style={{
                    position: 'absolute', top: -10, right: 14,
                    background: p.color, color: '#fff',
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>{p.badge}</span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Radio */}
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${active ? p.color : '#d1d5db'}`,
                      background: active ? p.color : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}/>}
                    </div>
                    <div style={{ fontSize: 20 }}>{p.icon}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: active ? p.color : '#1f2937' }}>{p.name}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: active ? p.color : '#1f2937' }}>{p.price}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{p.period}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', paddingLeft: 30 }}>
                  {p.features.map(f => (
                    <span key={f} style={{ fontSize: 12, color: active ? p.color : '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: active ? p.color : '#9ca3af' }}>✓</span> {f}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Contact form — slides in after plan selected */}
        {selectedPlan && (
          <form onSubmit={submit} style={{
            background: '#fff', borderRadius: 20, padding: 20,
            border: `1.5px solid ${plan?.border}`,
            boxShadow: `0 8px 32px ${plan?.glow}`,
            animation: 'slideUp 0.25s ease',
          }}>
            <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

            <div style={{ fontSize: 14, fontWeight: 800, color: '#1f2937', marginBottom: 14 }}>
              {plan?.icon} Your Details — {plan?.name} Plan
            </div>

            {err && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '10px 14px', fontSize: 12, color: '#dc2626', marginBottom: 12,
              }}>⚠️ {err}</div>
            )}

            {[
              { key: 'full_name', label: 'Full Name', placeholder: 'Your name', type: 'text' },
              { key: 'email',     label: 'Email',     placeholder: 'you@example.com', type: 'email' },
              { key: 'phone',     label: 'Phone',     placeholder: '+91 98765 43210', type: 'tel' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700,
                  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
                }}>{field.label} *</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={form[field.key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: `1.5px solid ${plan?.border || '#e5e7eb'}`,
                    fontSize: 14, color: '#1f2937', background: '#f9fafb',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            {selectedPlan === 'custom' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700,
                  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
                }}>Tell us about your needs</label>
                <textarea
                  placeholder="Describe your setup, number of zones, special requirements…"
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: `1.5px solid ${plan?.border || '#e5e7eb'}`,
                    fontSize: 14, color: '#1f2937', background: '#f9fafb',
                    outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <button type="submit" disabled={saving} style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: saving ? '#e5e7eb' : `linear-gradient(135deg,${plan?.color},${plan?.color}cc)`,
              color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: saving ? 'default' : 'pointer',
              boxShadow: saving ? 'none' : `0 4px 18px ${plan?.glow}`,
              transition: 'all 0.2s', marginBottom: 10,
            }}>
              {saving ? 'Sending…' : `📬 Request ${plan?.name} Plan Access`}
            </button>

            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
              We'll contact you within 24 hours to complete your setup.
            </p>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/login" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
            Already have an account? <span style={{ color: '#059669', fontWeight: 700 }}>Sign in →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
