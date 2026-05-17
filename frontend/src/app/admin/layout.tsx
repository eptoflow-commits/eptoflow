'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { tokens } from '@/lib/api';

const NAV = [
  { href: '/admin',                      label: 'Dashboard' },
  { href: '/admin/contact-requests',     label: '📬 Requests' },
  { href: '/admin/users',                label: 'Users' },
  { href: '/admin/devices',              label: 'Devices' },
  { href: '/admin/subscriptions',        label: 'Subscriptions' },
  { href: '/admin/payments',             label: 'Payments' },
  { href: '/admin/expenses',             label: '💰 Expenses' },
  { href: '/admin/schedules',            label: 'Schedules' },
  { href: '/admin/audit',               label: 'Audit' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (pathname === '/admin/login') { setOk(true); return; }
    if (!tokens.getAdmin()) { router.replace('/admin/login'); return; }
    setOk(true);
  }, [pathname, router]);

  if (!ok) return null;
  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="font-semibold">Eptoflow · Admin</Link>
          <button onClick={() => { tokens.clearAdmin(); router.replace('/admin/login'); }}
                  className="text-sm opacity-80 hover:opacity-100">
            Sign out
          </button>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4">
        <nav className="flex overflow-x-auto gap-1 border-b border-gray-200 bg-white -mx-4 px-4 sticky top-0 z-10">
          {NAV.map((n) => {
            const active = n.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                    className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${active ? 'border-brand-600 text-brand-700 font-semibold' : 'border-transparent text-gray-600'}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="py-4">{children}</div>
      </div>
    </div>
  );
}
