'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState('pending');
  const load = async () => {
    const { payments } = await api<{ payments: any[] }>(
      `/api/admin/payments${filter ? `?status=${filter}` : ''}`, { auth: 'admin' }
    );
    setPayments(payments);
  };
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (p: any, decision: 'verified' | 'rejected') => {
    const note = decision === 'rejected' ? prompt('Reason (optional)') || '' : '';
    await api(`/api/admin/payments/${p.id}/verify`, {
      method: 'POST', auth: 'admin', body: JSON.stringify({ decision, note }),
    });
    load();
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {['pending', 'verified', 'rejected', ''].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-sm border ${filter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200'}`}>
            {f || 'all'}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-100 rounded">
          <thead className="text-xs text-gray-500"><tr>
            <th className="p-2 text-left">User</th>
            <th className="p-2 text-left">Amount</th>
            <th className="p-2 text-left">Reference</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Submitted</th>
            <th />
          </tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t text-sm">
                <td className="p-2">{p.email}</td>
                <td className="p-2">${Number(p.amount).toFixed(2)}</td>
                <td className="p-2 max-w-xs truncate">{p.payment_reference || '—'}</td>
                <td className="p-2">
                  <span className={p.verification_status === 'verified' ? 'badge-green'
                                 : p.verification_status === 'rejected' ? 'badge-red' : 'badge-gray'}>
                    {p.verification_status}
                  </span>
                </td>
                <td className="p-2">{new Date(p.created_at).toLocaleString()}</td>
                <td className="p-2 space-x-2">
                  {p.verification_status === 'pending' && <>
                    <button className="btn-primary" onClick={() => decide(p, 'verified')}>Verify</button>
                    <button className="btn-secondary" onClick={() => decide(p, 'rejected')}>Reject</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
