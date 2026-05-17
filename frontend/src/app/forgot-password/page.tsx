'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST', auth: 'none',
        body: JSON.stringify({ email: email.trim(), phone: phone.trim() || undefined }),
      });
      setDone(true);
    } catch (e: any) { setErr(e.message || 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <style>{`
        @keyframes logoIn {
          0%  { opacity:0; transform:scale(0.85) translateY(-16px); }
          60% { opacity:1; transform:scale(1.03) translateY(2px); }
          100%{ opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes formIn {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes successPop {
          0%  { opacity:0; transform:scale(0.8); }
          60% { opacity:1; transform:scale(1.05); }
          100%{ opacity:1; transform:scale(1); }
        }
        .frm { opacity:0; transform:translateY(28px); transition:opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1); }
        .frm.in { opacity:1; transform:translateY(0); }
        .reset-input {
          width:100%; padding:12px 14px; border-radius:12px;
          border:1.5px solid #e2e8f0; font-size:14px; color:#0f172a;
          background:#f8fafc; outline:none; box-sizing:border-box;
          transition:border-color 0.15s, background 0.15s; font-family:inherit;
        }
        .reset-input:focus { border-color:#059669; background:#fff; }
        .reset-btn {
          width:100%; padding:13px 0; border-radius:50px; border:none;
          background:linear-gradient(135deg,#059669,#047857);
          color:#fff; font-size:15px; font-weight:800; cursor:pointer;
          box-shadow:0 4px 0 #047857, 0 8px 24px rgba(5,150,105,0.4);
          transition:transform 0.15s, box-shadow 0.15s;
          letter-spacing:-0.01em;
        }
        .reset-btn:not(:disabled):hover { transform:translateY(-2px); box-shadow:0 6px 0 #047857, 0 12px 32px rgba(5,150,105,0.5); }
        .reset-btn:not(:disabled):active { transform:translateY(2px); box-shadow:0 2px 0 #047857; }
        .reset-btn:disabled { opacity:0.65; cursor:not-allowed; box-shadow:none; }
      `}</style>

      <div style={{
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        padding:24, background:'linear-gradient(135deg,#f0fdf4,#ffffff,#ecfdf5)',
      }}>
        <div style={{ width:'100%', maxWidth:360 }}>

          {/* Logo */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}>
            <img src="/logo.jpeg" alt="Eptoflow"
              style={{ width:'100%', maxWidth:240, height:'auto', borderRadius:14,
                boxShadow:'0 8px 32px rgba(5,150,105,0.12)',
                animation:'logoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }} />
          </div>

          {done ? (
            /* ── Success screen ── */
            <div style={{
              background:'#fff', borderRadius:24, padding:28, textAlign:'center',
              border:'2px solid #d1fae5', boxShadow:'0 16px 48px rgba(5,150,105,0.12)',
              animation:'successPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              <div style={{ fontSize:60, marginBottom:12 }}>📬</div>
              <div style={{ fontSize:20, fontWeight:900, color:'#0f172a', marginBottom:8, letterSpacing:'-0.03em' }}>
                Request sent!
              </div>
              <div style={{ fontSize:14, color:'#64748b', lineHeight:1.7, marginBottom:24 }}>
                Your admin has been notified. They'll reset your password and reach you at{' '}
                <strong style={{ color:'#0f172a' }}>{phone || email}</strong> shortly.
              </div>
              <Link href="/login" style={{
                display:'inline-block', padding:'13px 32px', borderRadius:50,
                background:'linear-gradient(135deg,#059669,#047857)',
                color:'#fff', fontWeight:800, fontSize:14, textDecoration:'none',
                boxShadow:'0 4px 0 #047857, 0 8px 24px rgba(5,150,105,0.4)',
              }}>Back to Sign In →</Link>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={submit} className={`frm${mounted ? ' in' : ''}`} style={{
              background:'#fff', borderRadius:24, padding:'28px 24px',
              border:'1.5px solid #d1fae5',
              boxShadow:'0 20px 60px rgba(5,150,105,0.1), 0 4px 16px rgba(0,0,0,0.04)',
            }}>
              <div style={{ textAlign:'center', marginBottom:22 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#059669', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
                  🔑 Password Reset
                </div>
                <h1 style={{ fontSize:20, fontWeight:900, color:'#0f172a', margin:0, letterSpacing:'-0.03em' }}>
                  Forgot your password?
                </h1>
                <p style={{ fontSize:13, color:'#64748b', margin:'6px 0 0', lineHeight:1.6 }}>
                  No worries — your admin will set a new one and get in touch.
                </p>
              </div>

              {err && (
                <div style={{ fontSize:13, color:'#dc2626', background:'#fef2f2', border:'1.5px solid #fecaca',
                  borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  <span>⚠️</span> {err}
                </div>
              )}

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b',
                  textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                  Email address *
                </label>
                <input className="reset-input" type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>

              <div style={{ marginBottom:22 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b',
                  textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>
                  WhatsApp / Phone <span style={{ fontSize:10, color:'#94a3b8', textTransform:'none', letterSpacing:0 }}>(optional — so admin can reach you faster)</span>
                </label>
                <input className="reset-input" type="tel" placeholder="+91 98765 43210"
                  value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" />
              </div>

              <button type="submit" disabled={busy} className="reset-btn">
                {busy ? '📤 Sending request…' : '📬 Request Password Reset'}
              </button>

              <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', marginTop:16 }}>
                Your admin will be notified and reach you within 24 hours.
              </p>

              <div style={{ textAlign:'center', marginTop:12 }}>
                <Link href="/login" style={{ fontSize:13, color:'#64748b', textDecoration:'none' }}>
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
