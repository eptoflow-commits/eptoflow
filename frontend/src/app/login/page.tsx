'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [err,       setErr]       = useState<string | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [mounted,   setMounted]   = useState(false);
  const [splashing, setSplashing] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await login(email, password);
      setSplashing(true);
      setTimeout(() => router.replace('/dashboard'), 1100);
    } catch (e: any) {
      setErr(e.message || 'Login failed');
      setBusy(false);
    }
  };

  return (
    <>
      <style>{`
        /* ── Animations ── */
        @keyframes leafDraw {
          from { stroke-dashoffset: 600; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes logoScale {
          0%   { opacity:0; transform:scale(0.7) translateY(-12px); }
          60%  { opacity:1; transform:scale(1.04) translateY(2px); }
          100% { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes formRise {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes splashWave {
          0%   { clip-path:circle(0% at 50% 50%); }
          100% { clip-path:circle(160% at 50% 50%); }
        }
        @keyframes particleBurst {
          0%   { transform:translate(0,0) scale(1); opacity:0.9; }
          100% { transform:translate(var(--tx),var(--ty)) scale(0); opacity:0; }
        }
        @keyframes welcomeIn {
          from { opacity:0; transform:scale(0.85) translateY(12px); }
          60%  { transform:scale(1.04); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes shimmerBtn {
          0%   { background-position:200% 0; }
          100% { background-position:-200% 0; }
        }
        @keyframes errorShake {
          0%,100% { transform:translateX(0); }
          20%     { transform:translateX(-6px); }
          40%     { transform:translateX(6px); }
          60%     { transform:translateX(-4px); }
          80%     { transform:translateX(4px); }
        }

        /* ── Splash ── */
        .splash {
          position:fixed; inset:0; z-index:9999;
          background:linear-gradient(160deg,#060F0A 0%,#0D5C3D 60%,#22C55E 100%);
          clip-path:circle(0% at 50% 50%);
          animation:splashWave 1.0s cubic-bezier(0.4,0,0.2,1) forwards;
          display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:18px;
        }
        .particle {
          position:absolute; width:10px; height:10px; border-radius:50%;
          background:#22C55E; animation:particleBurst 0.9s ease-out forwards;
        }

        /* ── Form ── */
        .login-wrap {
          opacity:0; transform:translateY(28px);
          transition:opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,1,0.36,1);
        }
        .login-wrap.in { opacity:1; transform:translateY(0); }

        /* ── Input focus ring ── */
        .ep-input:focus { outline:none; border-color:#0D5C3D !important; background:white !important; box-shadow:0 0 0 3px rgba(13,92,61,0.14) !important; }

        /* ── CTA button ── */
        .ep-btn {
          width:100%; padding:14px 0; border-radius:99px; border:none;
          background:linear-gradient(135deg,#0D5C3D 0%,#15803D 100%);
          color:white; font-size:15px; font-weight:800; letter-spacing:-0.01em;
          cursor:pointer; position:relative; overflow:hidden;
          box-shadow:0 4px 0 #052E1C, 0 8px 28px rgba(13,92,61,0.45);
          transition:transform 0.12s, box-shadow 0.12s;
          font-family:inherit;
        }
        .ep-btn:not(:disabled):hover  { transform:translateY(-1px); box-shadow:0 5px 0 #052E1C, 0 12px 36px rgba(13,92,61,0.55); }
        .ep-btn:not(:disabled):active { transform:translateY(2px);  box-shadow:0 2px 0 #052E1C, 0 4px 14px rgba(13,92,61,0.30); }
        .ep-btn:disabled { opacity:0.6; cursor:not-allowed; box-shadow:none; }
        .ep-btn-shimmer {
          position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.28) 50%,transparent 60%);
          background-size:200% 100%;
          animation:shimmerBtn 2.2s infinite;
        }
      `}</style>

      {/* ── Splash overlay ── */}
      {splashing && (
        <div className="splash">
          {/* Particle burst */}
          {[...Array(8)].map((_,i) => (
            <div key={i} className="particle" style={{
              '--tx': `${Math.cos(i*45*Math.PI/180)*80}px`,
              '--ty': `${Math.sin(i*45*Math.PI/180)*80}px`,
              animationDelay:`${i*0.05}s`,
              top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            } as any}/>
          ))}

          {/* Icon */}
          <div style={{
            width:88, height:88, borderRadius:28,
            background:'rgba(255,255,255,0.15)', backdropFilter:'blur(16px)',
            border:'2px solid rgba(255,255,255,0.30)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:44,
            animation:'welcomeIn 0.55s 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
            boxShadow:'0 16px 48px rgba(0,0,0,0.30)',
          }}>🌱</div>

          {/* Text */}
          <div style={{ textAlign:'center', animation:'welcomeIn 0.5s 0.45s ease both' }}>
            <div style={{ fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-0.03em' }}>Welcome back!</div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.70)', marginTop:4, fontWeight:600 }}>Starting your garden dashboard…</div>
          </div>
        </div>
      )}

      {/* ── Page ── */}
      <div style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:'28px 20px',
        background:'linear-gradient(160deg,#f0fdf4 0%,#ffffff 55%,#ecfdf5 100%)',
        position:'relative', overflow:'hidden',
      }}>
        {/* Ambient background blobs */}
        <div style={{ position:'absolute', top:-80, right:-60, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle,rgba(34,197,94,0.10) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-60, left:-40, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(14,165,233,0.07) 0%,transparent 70%)', pointerEvents:'none' }}/>

        <div style={{ width:'100%', maxWidth:360, position:'relative' }}>

          {/* Brand hero */}
          <div style={{ textAlign:'center', marginBottom:32, animation:'logoScale 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div style={{
              width:80, height:80, borderRadius:26,
              background:'linear-gradient(135deg,#0D5C3D,#15803D)',
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              fontSize:42, marginBottom:16,
              boxShadow:'0 12px 40px rgba(13,92,61,0.40), 0 4px 12px rgba(13,92,61,0.20)',
            }}>🌱</div>
            <div style={{ fontSize:28, fontWeight:900, color:'#0A1628', letterSpacing:'-0.04em', lineHeight:1 }}>Eptoflow</div>
            <div style={{ fontSize:13, color:'#6B7280', fontWeight:500, marginTop:5, letterSpacing:'0.04em' }}>Smart Irrigation Platform</div>
          </div>

          {/* Form card */}
          <div className={`login-wrap${mounted ? ' in' : ''}`} style={{
            background:'#fff',
            borderRadius:28,
            border:'1.5px solid #E4EFE9',
            boxShadow:'0 24px 64px rgba(13,92,61,0.09), 0 4px 16px rgba(0,0,0,0.04)',
            padding:'28px 26px',
          }}>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#0D5C3D', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6 }}>
                Sign in
              </div>
              <div style={{ fontSize:19, fontWeight:900, color:'#0A1628', letterSpacing:'-0.03em' }}>Welcome back</div>
            </div>

            {/* Error */}
            {err && (
              <div style={{
                background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:13,
                padding:'11px 14px', marginBottom:18, display:'flex', alignItems:'center', gap:9,
                animation:'errorShake 0.4s ease',
              }}>
                <span style={{ fontSize:16 }}>⚠️</span>
                <span style={{ fontSize:13, color:'#dc2626', fontWeight:600 }}>{err}</span>
              </div>
            )}

            <form onSubmit={submit}>
              {/* Email */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>Email address</label>
                <input
                  type="email" value={email} placeholder="you@example.com"
                  onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  className="ep-input"
                  style={{
                    width:'100%', padding:'13px 16px', borderRadius:14,
                    border:'1.5px solid #E4EFE9', fontSize:15, color:'#0A1628',
                    background:'#F8FAF9', outline:'none', boxSizing:'border-box',
                    transition:'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                    fontFamily:'inherit',
                  }}
                  onFocus={e => { e.target.style.borderColor='#0D5C3D'; e.target.style.background='white'; e.target.style.boxShadow='0 0 0 3px rgba(13,92,61,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor='#E4EFE9'; e.target.style.background='#F8FAF9'; e.target.style.boxShadow='none'; }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom:8 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>Password</label>
                <div style={{ position:'relative' }}>
                  <input
                    type={pwVisible ? 'text' : 'password'} value={password} placeholder="••••••••"
                    onChange={e => setPassword(e.target.value)}
                    required autoComplete="current-password"
                    className="ep-input"
                    style={{
                      width:'100%', padding:'13px 44px 13px 16px', borderRadius:14,
                      border:'1.5px solid #E4EFE9', fontSize:15, color:'#0A1628',
                      background:'#F8FAF9', outline:'none', boxSizing:'border-box',
                      transition:'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                      fontFamily:'inherit',
                    }}
                    onFocus={e => { e.target.style.borderColor='#0D5C3D'; e.target.style.background='white'; e.target.style.boxShadow='0 0 0 3px rgba(13,92,61,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor='#E4EFE9'; e.target.style.background='#F8FAF9'; e.target.style.boxShadow='none'; }}
                  />
                  <button type="button" onClick={() => setPwVisible(v=>!v)} style={{
                    position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', cursor:'pointer', padding:4,
                    fontSize:16, color:'#9CA3AF', lineHeight:1,
                  }}>
                    {pwVisible ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div style={{ textAlign:'right', marginBottom:22 }}>
                <a href="/forgot-password" style={{ fontSize:12, color:'#0D5C3D', textDecoration:'none', fontWeight:700 }}>
                  Forgot password?
                </a>
              </div>

              <button type="submit" disabled={busy} className="ep-btn">
                <span className="ep-btn-shimmer"/>
                <span style={{ position:'relative', zIndex:1 }}>
                  {busy ? '🌱 Signing in…' : 'Sign in to Eptoflow →'}
                </span>
              </button>
            </form>

            <p style={{ textAlign:'center', fontSize:11, color:'#9CA3AF', marginTop:20, lineHeight:1.6 }}>
              Access is managed by your administrator.<br/>Contact support if you need help.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
