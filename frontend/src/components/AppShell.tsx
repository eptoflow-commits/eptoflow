'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';

const NAV = [
  { href: '/dashboard',     label: 'Dashboard' },
  { href: '/devices',       label: 'Devices' },
  { href: '/schedules',     label: 'Schedules' },
  { href: '/subscription',  label: 'Plan' },
  { href: '/notifications', label: 'Alerts' },
  { href: '/profile',       label: 'Profile' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-brand-700">Eptoflow</Link>
          <button onClick={() => { logout(); router.replace('/login'); }}
                  className="text-sm text-gray-500 hover:text-gray-800">
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-20">
        <div className="max-w-3xl mx-auto grid grid-cols-6">
          {NAV.map((n) => {
            const active = pathname?.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                    className={`py-2 text-center text-xs ${active ? 'text-brand-700 font-semibold' : 'text-gray-500'}`}>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
