'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [splashing, setSplashing] = useState(false);

  useEffect(() => {
    // tiny delay so CSS transition fires on mount
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await login(email, password);
      // trigger splash then navigate
      setSplashing(true);
      setTimeout(() => router.replace('/dashboard'), 900);
    } catch (e: any) {
      setErr(e.message || 'Login failed');
      setBusy(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes logoIn {
          0%  { opacity:0; transform:scale(0.82) translateY(-18px); }
          60% { opacity:1; transform:scale(1.04) translateY(2px); }
          100%{ opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes formIn {
          from { opacity:0; transform:translateY(32px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes splash {
          0%   { clip-path:circle(0% at 50% 50%); opacity:1; }
          70%  { clip-path:circle(80% at 50% 50%); opacity:1; }
          100% { clip-path:circle(150% at 50% 50%); opacity:1; }
        }
        @keyframes droplet {
          0%   { transform:scale(1); opacity:0.6; }
          100% { transform:scale(2.8); opacity:0; }
        }
        @keyframes checkPop {
          0%  { transform:scale(0) rotate(-20deg); opacity:0; }
          60% { transform:scale(1.2) rotate(4deg); opacity:1; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }
        .login-logo {
          animation: logoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .login-form {
          opacity:0; transform:translateY(32px);
          transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,1,0.36,1);
        }
        .login-form.in {
          opacity:1; transform:translateY(0);
        }
        .splash-overlay {
          position:fixed; inset:0; z-index:9999;
          background: linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%);
          clip-path:circle(0% at 50% 50%);
          animation: splash 0.9s cubic-bezier(0.4,0,0.2,1) forwards;
          display:flex; align-items:center; justify-content:center;
          flex-direction:column; gap:16px;
        }
        .splash-ring {
          position:absolute;
          width:180px; height:180px;
          border-radius:50%;
          border:4px solid rgba(255,255,255,0.4);
          animation:droplet 0.9s ease-out forwards;
        }
        .splash-check {
          font-size:72px;
          animation:checkPop 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .splash-text {
          color:#fff; font-size:20px; font-weight:800; letter-spacing:-0.02em;
          animation:checkPop 0.5s 0.45s ease both;
        }
        .btn-signin {
          width:100%; padding:13px 0;
          border-radius:50px; border:none;
          background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
          color:#fff; font-size:15px; font-weight:800;
          letter-spacing:-0.01em; cursor:pointer;
          box-shadow: 0 4px 0 #047857, 0 8px 24px rgba(5,150,105,0.4);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          position:relative; overflow:hidden;
        }
        .btn-signin:not(:disabled):hover {
          transform:translateY(-2px);
          box-shadow:0 6px 0 #047857, 0 12px 32px rgba(5,150,105,0.5);
        }
        .btn-signin:not(:disabled):active {
          transform:translateY(2px);
          box-shadow:0 2px 0 #047857, 0 4px 12px rgba(5,150,105,0.3);
        }
        .btn-signin:disabled { opacity:0.65; cursor:not-allowed; box-shadow:none; }
        .btn-signin .shimmer {
          position:absolute; inset:0;
          background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.35) 50%,transparent 60%);
          background-size:200% 100%;
          animation:shimmerSlide 2s infinite;
        }
        @keyframes shimmerSlide {
          0%  { background-position:200% 0; }
          100%{ background-position:-200% 0; }
        }
      `}</style>

      {/* Splash overlay on successful login */}
      {splashing && (
        <div className="splash-overlay">
          <div className="splash-ring" />
          <div className="splash-check">✅</div>
          <div className="splash-text">Welcome to Eptoflow</div>
        </div>
      )}

      <div style={{
        minHeight:'100vh',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'24px',
        background:'linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #ecfdf5 100%)',
      }}>
        <div style={{ width:'100%', maxWidth:360 }}>

          {/* Logo */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:28 }}>
            <img
              src="/logo.jpeg"
              alt="Eptoflow"
              className="login-logo"
              style={{ width:'100%', maxWidth:280, height:'auto', borderRadius:16,
                boxShadow:'0 8px 32px rgba(5,150,105,0.12)' }}
            />
          </div>

          {/* Form card */}
          <form
            onSubmit={submit}
            className={`login-form${mounted ? ' in' : ''}`}
            style={{
              background:'#ffffff',
              borderRadius:24,
              border:'1.5px solid #d1fae5',
              boxShadow:'0 20px 60px rgba(5,150,105,0.1), 0 4px 16px rgba(0,0,0,0.04)',
              padding:'28px 24px',
            }}
          >
            <div style={{ textAlign:'center', marginBottom:22 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#059669', letterSpacing:'0.08em',
                textTransform:'uppercase', marginBottom:6 }}>
                🌿 Eptoflow
              </div>
              <h1 style={{ fontSize:22, fontWeight:900, color:'#0f172a', margin:0,
                letterSpacing:'-0.03em' }}>Welcome back</h1>
              <p style={{ fontSize:13, color:'#64748b', margin:'4px 0 0' }}>
                Sign in to your account
              </p>
            </div>

            {err && (
              <div style={{
                fontSize:13, color:'#dc2626', background:'#fef2f2',
                border:'1.5px solid #fecaca', borderRadius:10,
                padding:'10px 14px', marginBottom:16,
                display:'flex', alignItems:'center', gap:8,
              }}>
                <span>⚠️</span> {err}
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width:'100%', padding:'12px 14px', borderRadius:12,
                  border:'1.5px solid #e2e8f0', fontSize:14, color:'#0f172a',
                  background:'#f8fafc', outline:'none', boxSizing:'border-box',
                  transition:'border-color 0.15s, background 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor='#059669'; e.target.style.background='#fff'; }}
                onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc'; }}
              />
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width:'100%', padding:'12px 14px', borderRadius:12,
                  border:'1.5px solid #e2e8f0', fontSize:14, color:'#0f172a',
                  background:'#f8fafc', outline:'none', boxSizing:'border-box',
                  transition:'border-color 0.15s, background 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor='#059669'; e.target.style.background='#fff'; }}
                onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc'; }}
              />
            </div>

            <button type="submit" disabled={busy} className="btn-signin">
              <span className="shimmer" />
              <span style={{ position:'relative', zIndex:1 }}>
                {busy ? '🌿 Signing in…' : '🔐 Sign in to Eptoflow'}
              </span>
            </button>

            <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', marginTop:16 }}>
              Access is provided by your administrator.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
