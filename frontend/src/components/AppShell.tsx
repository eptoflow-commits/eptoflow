'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';

/* ── SVG Nav Icons ─────────────────────────────────── */
function IcoHome({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-1.72-1.72V5.25a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75V8.5l-4.55-4.54a.75.75 0 00-1.06 0l-8.69 8.69a.75.75 0 001.06 1.06l.72-.72V19.5a.75.75 0 00.75.75h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v4.5a.75.75 0 00.75.75h4.5a.75.75 0 00.75-.75V12.53l.72.71a.75.75 0 001.06-1.06z"/></svg>
    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
}
function IcoDevices({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V4a2 2 0 00-2-2H4zm8 17.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM8 6.75A.75.75 0 018.75 6h6.5a.75.75 0 010 1.5h-6.5A.75.75 0 018 6.75zm0 4a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4A.75.75 0 018 10.75z"/></svg>
    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/><path d="M8 6h8M8 10h5"/></svg>;
}
function IcoClock({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd"/></svg>
    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>;
}
function IcoStar({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd"/></svg>
    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function IcoUser({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd"/></svg>
    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
}

const NAV = [
  { href:'/dashboard',    label:'Home',     Icon:IcoHome    },
  { href:'/devices',      label:'Devices',  Icon:IcoDevices },
  { href:'/schedules',    label:'Schedule', Icon:IcoClock   },
  { href:'/subscription', label:'Plan',     Icon:IcoStar    },
  { href:'/profile',      label:'Profile',  Icon:IcoUser    },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, loading, logout } = useAuth();
  const [scrolled, setScrolled]   = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 6);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* Loading skeleton */
  if (loading || !user) {
    return (
      <div style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:18,
        background:'linear-gradient(160deg,#060F0A 0%,#0A2218 50%,#1A3A27 100%)',
      }}>
        <div style={{
          width:64, height:64, borderRadius:20,
          background:'linear-gradient(135deg,#0D5C3D,#22C55E)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:32, boxShadow:'0 12px 40px rgba(13,92,61,0.6)',
        }}>🌱</div>
        <div style={{
          width:32, height:32, borderRadius:'50%',
          border:'3px solid rgba(34,197,94,0.3)',
          borderTopColor:'#22C55E',
          animation:'spin 0.9s linear infinite',
        }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(href);

  return (
    <div style={{ minHeight:'100vh', background:'var(--fog)', paddingBottom:'calc(76px + env(safe-area-inset-bottom))' }}>
      <style>{`
        @keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.75)}}
        @keyframes navPress{0%,100%{transform:scale(1)}50%{transform:scale(0.92)}}
        .nav-btn:active{animation:navPress 0.12s ease}
        .nav-btn{transition:color 0.18s ease}
      `}</style>

      {/* ── Header ── */}
      <header style={{
        position:'sticky', top:0, zIndex:50,
        background: scrolled ? 'rgba(255,255,255,0.90)' : 'white',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom:`1px solid ${scrolled ? 'rgba(0,0,0,0.07)' : 'var(--haze)'}`,
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.07)' : 'none',
        transition:'all 0.25s ease',
      }}>
        <div style={{ maxWidth:680, margin:'0 auto', padding:'0 16px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>

          {/* Brand */}
          <Link href="/dashboard" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <div style={{
              width:36, height:36, borderRadius:11,
              background:'linear-gradient(135deg,#0D5C3D,#15803D)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, boxShadow:'0 3px 10px rgba(13,92,61,0.30)',
              flexShrink:0,
            }}>🌱</div>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:scrolled ? '#0A1628' : '#0D5C3D', letterSpacing:'-0.03em', lineHeight:1.1 }}>
                Eptoflow
              </div>
              <div style={{ fontSize:9, color:'#0D5C3D', fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', opacity:0.7 }}>
                Smart Irrigation
              </div>
            </div>
          </Link>

          {/* Right */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'5px 12px', borderRadius:20,
              background:'var(--sprout)', border:'1px solid var(--leaf)',
            }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 0 2px rgba(34,197,94,0.25)', animation:'pulseDot 2s infinite' }}/>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--forest)' }}>
                {user.full_name?.split(' ')[0]}
              </span>
            </div>
            <button onClick={() => { logout(); router.replace('/login'); }} style={{
              width:32, height:32, borderRadius:10, border:'1px solid var(--haze)',
              background:'var(--fog)', display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', fontSize:15, color:'var(--dust)', transition:'all 0.15s',
            }} title="Sign out">↩</button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ maxWidth:680, margin:'0 auto', padding:'0 16px' }}>
        {children}
      </main>

      {/* ── Bottom Navigation ── */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        background:'rgba(255,255,255,0.95)',
        backdropFilter:'blur(24px)',
        WebkitBackdropFilter:'blur(24px)',
        borderTop:'1px solid rgba(0,0,0,0.06)',
        boxShadow:'0 -4px 30px rgba(0,0,0,0.08)',
        paddingBottom:'env(safe-area-inset-bottom)',
      }}>
        <div style={{ maxWidth:680, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(5,1fr)', padding:'6px 8px 8px' }}>
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} style={{ textDecoration:'none' }}>
                <div className="nav-btn" style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  padding:'7px 4px 5px', borderRadius:16, gap:3,
                  background: active ? 'var(--sprout)' : 'transparent',
                  transition:'background 0.2s',
                  position:'relative',
                }}>
                  {/* Active indicator dot */}
                  {active && (
                    <div style={{
                      position:'absolute', top:4, left:'50%', transform:'translateX(-50%)',
                      width:4, height:4, borderRadius:'50%', background:'var(--forest)',
                    }}/>
                  )}
                  <div style={{
                    color: active ? 'var(--forest)' : 'var(--dust)',
                    marginTop: active ? 3 : 0,
                    transition:'all 0.2s',
                  }}>
                    <Icon filled={active} />
                  </div>
                  <span style={{
                    fontSize:10, fontWeight: active ? 800 : 500,
                    color: active ? 'var(--forest)' : 'var(--dust)',
                    letterSpacing: active ? '-0.01em' : '0',
                    transition:'all 0.2s',
                  }}>
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
