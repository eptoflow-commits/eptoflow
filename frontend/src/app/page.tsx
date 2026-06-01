'use client';
import Link from 'next/link';

const PLANS = [
  {
    name: 'Basic',    price: '₹249', emoji: '🪴',
    color: '#059669', dark: '#047857', glow: 'rgba(5,150,105,0.3)',
    features: ['Daily Water Plants', 'Motor or Light', 'Push notifications', 'Remote access'],
  },
  {
    name: 'Standard', price: '₹349', emoji: '🕐',
    color: '#0284c7', dark: '#0369a1', glow: 'rgba(2,132,199,0.3)',
    badge: 'Best Value',
    features: ['Daily Water Plants', 'Motor or Light', 'Scheduled watering', 'Weekly reports', 'Remote access'],
  },
  {
    name: 'Premium',  price: '₹499', emoji: '🌟',
    color: '#7c3aed', dark: '#6d28d9', glow: 'rgba(124,58,237,0.3)',
    badge: 'Most Popular',
    features: ['All 3 plant zones', 'Soil moisture sensor', 'Voice control', 'Weather-based watering', 'Smart automation'],
  },
  {
    name: 'Custom',   price: 'Talk to us', emoji: '⚙️',
    color: '#b45309', dark: '#92400e', glow: 'rgba(180,83,9,0.25)',
    features: ['Tailored setup', 'Multiple devices', 'Priority support', 'Custom integrations'],
  },
];

const FEATURES = [
  { icon: '💧', title: 'Smart Watering',      desc: 'Schedule and automate watering cycles — no manual effort required.' },
  { icon: '🌡️', title: 'Soil Sensor',         desc: 'Real-time moisture and temperature readings from your soil.' },
  { icon: '🎙️', title: 'Voice Control',       desc: 'Control your irrigation hands-free with built-in voice commands.' },
  { icon: '🌤️', title: 'Weather Aware',       desc: 'Automatically skip watering when rain is forecast.' },
  { icon: '📱', title: 'Works Everywhere',    desc: 'Installable PWA on mobile and desktop — works offline too.' },
  { icon: '⚡', title: 'Instant Commands',    desc: 'Send commands that execute on your device within seconds.' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        .float { animation: float 4s ease-in-out infinite; }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .plan-card:hover { transform:translateY(-4px) !important; }
        .feat-card:hover { border-color:rgba(52,211,153,0.4) !important; background:rgba(52,211,153,0.05) !important; }
        .cta-btn:hover { transform:scale(1.04); box-shadow:0 8px 32px rgba(52,211,153,0.5) !important; }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,15,30,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg,#34d399,#059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>🪴</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>Eptoflow</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/login" style={{
            padding: '8px 18px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            transition: 'all 0.2s',
          }}>Sign In</Link>
          <Link href="/signup" style={{
            padding: '8px 18px', borderRadius: 10,
            background: 'linear-gradient(135deg,#34d399,#059669)',
            color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(52,211,153,0.35)',
            transition: 'all 0.2s',
          }}>Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: '60px 20px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 400,
          background: 'radial-gradient(ellipse,rgba(52,211,153,0.15) 0%,transparent 70%)',
          pointerEvents: 'none',
        }}/>

        {/* Logo */}
        <div className="float" style={{ marginBottom: 28 }}>
          <img src="/logo.jpeg" alt="Eptoflow"
            style={{ width: 140, height: 140, borderRadius: 32, margin: '0 auto', display: 'block',
              boxShadow: '0 12px 48px rgba(52,211,153,0.3), 0 0 0 1px rgba(52,211,153,0.2)' }}
          />
        </div>

        <div className="fade-up" style={{ animationDelay: '0.1s' }}>
          <div style={{
            display: 'inline-block', marginBottom: 16, padding: '6px 16px', borderRadius: 20,
            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
            fontSize: 12, fontWeight: 700, color: '#34d399', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>🌱 Smart Plant Care System</div>
        </div>

        <h1 className="fade-up" style={{
          fontSize: 40, fontWeight: 900, lineHeight: 1.1,
          letterSpacing: '-0.03em', marginBottom: 16,
          animationDelay: '0.15s',
          background: 'linear-gradient(135deg,#fff 0%,#34d399 60%,#0ea5e9 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Water Smarter,<br/>Grow Better
        </h1>

        <p className="fade-up" style={{
          fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6,
          maxWidth: 320, margin: '0 auto 32px',
          animationDelay: '0.2s',
        }}>
          Eptoflow gives you full control over your irrigation — soil sensors, voice control, and weather-aware automation from any device.
        </p>

        <div className="fade-up" style={{ display: 'flex', gap: 10, justifyContent: 'center', animationDelay: '0.25s' }}>
          <Link href="/signup" className="cta-btn" style={{
            padding: '14px 28px', borderRadius: 14,
            background: 'linear-gradient(135deg,#34d399,#059669)',
            color: '#fff', fontSize: 15, fontWeight: 800, textDecoration: 'none',
            boxShadow: '0 6px 24px rgba(52,211,153,0.4)',
            transition: 'all 0.2s',
          }}>Start Free →</Link>
          <Link href="/login" style={{
            padding: '14px 28px', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: 600, textDecoration: 'none',
            transition: 'all 0.2s',
          }}>Sign In</Link>
        </div>

        {/* Stats row */}
        <div className="fade-up" style={{
          marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: 1, maxWidth: 380, margin: '48px auto 0',
          background: 'rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          animationDelay: '0.3s',
        }}>
          {[
            { val: '4', label: 'Plans' },
            { val: '8', label: 'Relay Channels' },
            { val: '24/7', label: 'Monitoring' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '16px 12px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#34d399', letterSpacing: '-0.03em' }}>{s.val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '40px 20px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>What you get</div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff' }}>Everything your garden needs</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="feat-card" style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '16px 14px',
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ padding: '40px 20px 20px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Pricing</div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff' }}>Simple, transparent plans</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>Pick a plan and we'll set everything up for you</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PLANS.map((p) => (
            <Link key={p.name} href="/signup" style={{ textDecoration: 'none' }}>
              <div className="plan-card" style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid rgba(255,255,255,0.1)`,
                borderRadius: 18, padding: '16px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.2s',
              }}>
                {/* Left accent bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: 3, background: p.color, borderRadius: '18px 0 0 18px',
                }}/>

                {/* Badge */}
                {p.badge && (
                  <div style={{
                    position: 'absolute', top: 0, right: 16,
                    background: `linear-gradient(135deg,${p.color},${p.dark})`,
                    color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: '0.08em',
                    padding: '3px 10px', borderRadius: '0 0 8px 8px', textTransform: 'uppercase',
                  }}>{p.badge}</div>
                )}

                {/* Icon */}
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: `${p.color}18`, border: `1px solid ${p.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>{p.emoji}</div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                    {p.features.slice(0, 3).join(' · ')}
                    {p.features.length > 3 && ' …'}
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: p.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{p.price}</div>
                  {p.price !== 'Talk to us' && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>/month</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '40px 20px 60px', textAlign: 'center' }}>
        <div style={{
          maxWidth: 340, margin: '0 auto',
          background: 'linear-gradient(135deg,rgba(52,211,153,0.1),rgba(14,165,233,0.1))',
          border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: 24, padding: '32px 24px',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🌿</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>Ready to grow smarter?</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, lineHeight: 1.5 }}>Join gardeners automating their plants with Eptoflow.</div>
          <Link href="/signup" className="cta-btn" style={{
            display: 'inline-block', padding: '14px 32px', borderRadius: 14,
            background: 'linear-gradient(135deg,#34d399,#059669)',
            color: '#fff', fontSize: 15, fontWeight: 800, textDecoration: 'none',
            boxShadow: '0 6px 24px rgba(52,211,153,0.4)',
            transition: 'all 0.2s',
          }}>Get Started Free →</Link>
        </div>
        <p style={{ marginTop: 32, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          © {new Date().getFullYear()} Eptoflow. All rights reserved.
        </p>
      </section>
    </div>
  );
}
