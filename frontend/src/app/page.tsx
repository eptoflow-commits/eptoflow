'use client';
import Link from 'next/link';

const PLANS = [
  {
    name: 'Basic',
    price: '₹249',
    emoji: '🪴',
    color: '#059669',
    glow: 'rgba(5,150,105,0.35)',
    dark: '#047857',
    features: ['Daily Water Plants', 'Motor or Light', 'Remote access'],
  },
  {
    name: 'Standard',
    price: '₹349',
    emoji: '📅',
    color: '#0284c7',
    glow: 'rgba(2,132,199,0.35)',
    dark: '#0369a1',
    badge: 'Best Value',
    features: ['Daily Water Plants', 'Motor or Light', 'Scheduled watering', 'Remote access'],
  },
  {
    name: 'Premium',
    price: '₹499',
    emoji: '🌟',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.35)',
    dark: '#6d28d9',
    badge: 'Most Popular',
    features: ['All 3 plant zones', 'Motor or Light', 'Soil moisture sensor', 'Voice control', 'Smart automation'],
  },
  {
    name: 'Custom',
    price: 'Talk to us',
    emoji: '⚙️',
    color: '#b45309',
    glow: 'rgba(180,83,9,0.3)',
    dark: '#92400e',
    features: ['Tailored to your setup', 'Multiple devices', 'Priority support', 'Custom integrations'],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <img src="/logo.jpeg" alt="Eptoflow" style={{ width:'100%', maxWidth:340, height:'auto', margin:'0 auto 2rem', display:'block' }} />
        <h1 className="text-4xl md:text-5xl font-bold text-brand-900 mb-4 leading-tight">
          Smart Plant Care,<br />Wherever You Are
        </h1>
        <p className="text-lg text-gray-600 mb-10 max-w-xl mx-auto">
          Eptoflow gives you full control over your irrigation and plant automation
          system — from any device, anytime.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/signup" className="btn-primary px-8 py-3 text-base">Get Started</Link>
          <Link href="/login" className="btn-secondary px-8 py-3 text-base">Sign In</Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-3 gap-6 mt-4">
          <div className="card text-center">
            <div className="text-3xl mb-3">💧</div>
            <h3 className="font-semibold text-brand-800 mb-1">Automated Watering</h3>
            <p className="text-sm text-gray-600">Schedule and automate watering cycles with precision — no manual effort required.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-brand-800 mb-1">Real-time Monitoring</h3>
            <p className="text-sm text-gray-600">Track soil moisture, device status, and activity logs from your dashboard.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">🎙️</div>
            <h3 className="font-semibold text-brand-800 mb-1">Voice Control</h3>
            <p className="text-sm text-gray-600">Control your irrigation system hands-free with built-in voice commands.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">📱</div>
            <h3 className="font-semibold text-brand-800 mb-1">Works on Any Device</h3>
            <p className="text-sm text-gray-600">Installable app experience on mobile and desktop — works offline too.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="font-semibold text-brand-800 mb-1">Secure & Reliable</h3>
            <p className="text-sm text-gray-600">End-to-end encrypted communication with automatic fail-safe protection.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-semibold text-brand-800 mb-1">Instant Commands</h3>
            <p className="text-sm text-gray-600">Send commands that execute on your device within seconds, from anywhere.</p>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Simple Pricing</h2>
        <p className="text-center text-sm text-gray-500 mb-8">Pick a plan and we'll set everything up for you.</p>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {PLANS.map((p) => (
            <Link key={p.name} href="/signup" style={{ textDecoration:'none' }}>
              <div style={{
                background:'#fff',
                borderRadius:20,
                padding:'16px 20px',
                border:`2px solid #e2e8f0`,
                boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
                display:'flex', alignItems:'center', gap:16,
                position:'relative', overflow:'hidden',
                transition:'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px ${p.glow}`;
                (e.currentTarget as HTMLElement).style.borderColor = p.color;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
              }}
              >
                {/* Badge */}
                {p.badge && (
                  <div style={{
                    position:'absolute', top:0, right:16,
                    background:`linear-gradient(135deg,${p.color},${p.dark})`,
                    color:'#fff', fontSize:9, fontWeight:900, letterSpacing:'0.1em',
                    padding:'4px 12px', borderRadius:'0 0 10px 10px',
                    textTransform:'uppercase',
                  }}>{p.badge}</div>
                )}

                {/* Emoji */}
                <div style={{ fontSize:28, flexShrink:0 }}>{p.emoji}</div>

                {/* Name + features */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:16, color:'#0f172a', marginBottom:4 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.5 }}>
                    {p.features.join(' · ')}
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:22, fontWeight:900, color: p.color, letterSpacing:'-0.03em', lineHeight:1 }}>
                    {p.price}
                  </div>
                  {p.price !== 'Talk to us' && (
                    <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600 }}>/month</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-10">
          &copy; {new Date().getFullYear()} Eptoflow. All rights reserved.
        </p>
      </div>
    </div>
  );
}
