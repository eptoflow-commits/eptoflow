'use client';
export const runtime = 'edge';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Redirect old /device/:id URLs to /device?id=:id
// The actual device UI lives at /device?id=:id (static page, no edge runtime)
export default function DeviceRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    if (id) router.replace(`/device?id=${id}`);
  }, [id, router]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
    </div>
  );
}
