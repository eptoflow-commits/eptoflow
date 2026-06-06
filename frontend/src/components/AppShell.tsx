'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/dashboard',    label: 'Home',      icon: House,    activeIcon: HouseFill },
  { href: '/devices',      label: 'Devices',   icon: Device,   activeIcon: DeviceFill },
  { href: '/schedules',    label: 'Schedule',  icon: Clock,    activeIcon: ClockFill },
  { href: '/subscription', label: 'Plan',      icon: Star,     activeIcon: StarFill },
  { href: '/profile',      label: 'Profile',   icon: User,     activeIcon: UserFill },
];

/* ── SVG icon components ──────────────────────────────────────── */
function House() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
}
function HouseFill() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-1.72-1.72V5.25a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75V8.5l-4.55-4.54a.75.75 0 00-1.06 0l-8.69 8.69a.75.75 0 001.06 1.06l.72-.72V19.5a.75.75 0 00.75.75h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v4.5a.75.75 0 00.75.75h4.5a.75.75 0 00.75-.75V12.53l.72.71z"/></svg>;
}
function Device() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/><path d="M8 6h8M8 10h5"/></svg>;
}
function DeviceFill() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 2H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V4a2 2 0 00-2-2zm-7 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM8 6h8a.75.75 0 010 1.5H8A.75.75 0 018 6zm0 4h5a.75.75 0 010 1.5H8A.75.75 0 018 10z"/></svg>;
}
function Clock() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>;
}
function ClockFill() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd"/></svg>;
}
function Star() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function StarFill() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd"/></svg>;
}
function User() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
}
function UserFill() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd"/></svg>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, loading, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading || !user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 16,
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%, #ecfdf5 100%)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #059669, #047857)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
          boxShadow: '0 8px 24px rgba(5,150,105,0.35)',
          animation: 'spin 1.2s linear infinite',
        }}>🌱</div>
        <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>
          Loading Eptoflow…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(href);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f8f5', paddingBottom: 80 }}>
      <style>{`
        @keyframes navPop {
          0%   { transform: scale(0.8) translateY(4px); opacity: 0; }
          60%  { transform: scale(1.08) translateY(-1px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .nav-icon-wrap { transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1); }
        .nav-item:active .nav-icon-wrap { transform: scale(0.9); }
        .header-glass {
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .header-solid { background: #ffffff; }
      `}</style>

      {/* ── Header ── */}
      <header
        className={scrolled ? 'header-glass' : 'header-solid'}
        style={{
          position: 'sticky', top: 0, zIndex: 40,
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.07)' : '1px solid #f1f5f9',
          transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
          boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        <div style={{
          maxWidth: 680, margin: '0 auto', padding: '0 16px',
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #059669, #047857)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, boxShadow: '0 3px 10px rgba(5,150,105,0.3)',
              flexShrink: 0,
            }}>🌱</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Eptoflow
              </div>
              <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Smart Irrigation
              </div>
            </div>
          </Link>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 12px', borderRadius: 20,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#059669',
                boxShadow: '0 0 0 3px rgba(5,150,105,0.2)',
                animation: 'pulseDot 2s ease infinite',
              }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>
                {user.full_name?.split(' ')[0]}
              </span>
            </div>
            <button
              onClick={() => { logout(); router.replace('/login'); }}
              style={{
                width: 32, height: 32, borderRadius: 10, border: '1px solid #e2e8f0',
                background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
              }}
              title="Sign out"
            >
              ↩
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 0' }}>
        {children}
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{
          maxWidth: 680, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          padding: '6px 8px 8px',
        }}>
          {NAV.map(({ href, label, icon: Icon, activeIcon: ActiveIcon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="nav-item"
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '6px 4px', borderRadius: 14,
                  textDecoration: 'none', gap: 3,
                  background: active ? '#f0fdf4' : 'transparent',
                  transition: 'background 0.2s',
                  position: 'relative',
                }}
              >
                {/* Active glow dot */}
                {active && (
                  <div style={{
                    position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%',
                    background: '#059669',
                  }}/>
                )}
                <div
                  className="nav-icon-wrap"
                  style={{
                    color: active ? '#059669' : '#94a3b8',
                    transition: 'color 0.2s, transform 0.15s',
                    marginTop: active ? 4 : 0,
                  }}
                >
                  {active ? <ActiveIcon /> : <Icon />}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: active ? 800 : 500,
                  color: active ? '#059669' : '#94a3b8',
                  letterSpacing: active ? '-0.01em' : '0',
                  transition: 'all 0.2s',
                }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
