'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';

const NAV = [
  { href: '/dashboard',    label: 'Home',      icon: '🏠' },
  { href: '/devices',      label: 'Devices',   icon: '📡' },
  { href: '/schedules',    label: 'Schedules', icon: '⏰' },
  { href: '/subscription', label: 'Plan',      icon: '💳' },
  { href: '/profile',      label: 'Profile',   icon: '👤' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.jpeg" alt="Eptoflow" className="h-12 w-auto animate-pulse" />
          <div className="text-sm text-gray-400">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard">
            <img src="/logo.jpeg" alt="Eptoflow" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">{user.email}</span>
            <button
              onClick={() => { logout(); router.replace('/login'); }}
              className="text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded border border-gray-200 hover:border-red-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-20 shadow-lg">
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {NAV.map((n) => {
            const active = n.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex flex-col items-center py-2 gap-0.5 transition-colors ${
                  active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="text-xl">{n.icon}</span>
                <span className={`text-[10px] font-medium ${active ? 'text-brand-600' : 'text-gray-400'}`}>
                  {n.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
