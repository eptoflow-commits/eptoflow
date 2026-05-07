'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Request = {
  id: string; user_id: string; full_name: string; email: string; phone: string | null;
  message: string; is_read: boolean; created_at: string;
  current_plan: string | null; sub_status: string | null; end_date: string | null;
};
type Sub = {
  id: string; user_id: string; email: string; full_name: string;
  plan_name: string; start_date: string; end_date: string; status: string;
};

export default function AdminSubsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [subs, setSubs]         = useState<Sub[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    try {
      const [r, s] = await Promise.all([
        api<{ requests: Request[] }>('/api/admin/premium-requests', { auth: 'admin' }),
        api<{ subscriptions: Sub[] }>('/api/admin/subscriptions', { auth: 'admin' }),
      ]);
      setRequests(r.requests);
      setSubs(s.subscriptions);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const dismiss = async (id: string) => {
    await api(`/api/admin/premium-requests/${id}/dismiss`, { method: 'POST', auth: 'admin' });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r));
  };

  const renew = async (s: Sub) => {
    if (!confirm(`Renew ${s.plan_name} plan for ${s.email}?`)) return;
    await api('/api/admin/subscriptions/renew', {
      method: 'POST', auth: 'admin',
      body: JSON.stringify({ user_id: s.user_id, plan: s.plan_name, subscription_id: s.id }),
    });
    load();
  };

  const activateForUser = async (userId: string, requestId: string) => {
    if (!confirm('Activate Premium plan for this user?')) return;
    await api('/api/admin/subscriptions/renew', {
      method: 'POST', auth: 'admin',
      body: JSON.stringify({ user_id: userId, plan: 'premium' }),
    });
    await dismiss(requestId);
    load();
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const pendingRequests = requests.filter(r => !r.is_read);
  const doneRequests    = requests.filter(r => r.is_read);

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 13, padding: 40, textAlign: 'center' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Upgrade Requests ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1f2937' }}>
            ⭐ Upgrade Requests
          </div>
          {pendingRequests.length > 0 && (
            <span style={{
              background: '#7c3aed', color: '#fff',
              fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
            }}>{pendingRequests.length} pending</span>
          )}
        </div>

        {pendingRequests.length === 0 ? (
          <div style={{
            background: '#f9fafb', borderRadius: 14, padding: '24px',
            textAlign: 'center', border: '2px dashed #e5e7eb',
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>No pending upgrade requests</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingRequests.map(r => (
              <div key={r.id} style={{
                background: '#fff', borderRadius: 14, padding: '14px 16px',
                border: '1.5px solid #c4b5fd',
                boxShadow: '0 4px 16px rgba(124,58,237,0.1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    {/* Name + current plan */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{r.full_name}</span>
                      {r.current_plan && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: '#f3f4f6', color: '#6b7280', textTransform: 'uppercase',
                        }}>Currently: {r.current_plan}</span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: '#fef3c7', color: '#d97706',
                      }}>→ Wants Premium</span>
                    </div>

                    {/* Contact details */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#374151' }}>
                        📧 <a href={`mailto:${r.email}`} style={{ color: '#7c3aed', fontWeight: 600 }}>{r.email}</a>
                      </span>
                      {r.phone && (
                        <span style={{ fontSize: 13, color: '#374151' }}>
                          📱 <a href={`tel:${r.phone}`} style={{ color: '#7c3aed', fontWeight: 600 }}>{r.phone}</a>
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      Requested {fmtDate(r.created_at)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => activateForUser(r.user_id, r.id)} style={{
                      padding: '7px 12px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                      color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
                    }}>✅ Activate Premium</button>
                    <button onClick={() => dismiss(r.id)} style={{
                      padding: '7px 12px', borderRadius: 8, border: 'none',
                      background: '#f3f4f6', color: '#6b7280',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dismissed requests (collapsed) */}
        {doneRequests.length > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer', padding: '4px 0' }}>
              {doneRequests.length} dismissed request{doneRequests.length > 1 ? 's' : ''}
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {doneRequests.map(r => (
                <div key={r.id} style={{
                  background: '#f9fafb', borderRadius: 10, padding: '10px 14px',
                  border: '1px solid #e5e7eb', fontSize: 13, color: '#6b7280',
                }}>
                  <strong style={{ color: '#374151' }}>{r.full_name}</strong>
                  {' · '}{r.email}
                  {r.phone && <> · {r.phone}</>}
                  <span style={{ float: 'right', fontSize: 11 }}>{fmtDate(r.created_at)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── All Subscriptions ── */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', marginBottom: 14 }}>
          📋 All Subscriptions
        </div>
        {subs.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 24 }}>No subscriptions yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subs.map(s => (
              <div key={s.id} style={{
                background: '#fff', borderRadius: 12, padding: '12px 16px',
                border: `1.5px solid ${s.status === 'active' ? '#6ee7b7' : '#e5e7eb'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', marginBottom: 2 }}>
                    {s.full_name}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>📧 {s.email}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                      background: s.plan_name === 'premium' ? '#f5f3ff' : '#ecfdf5',
                      color: s.plan_name === 'premium' ? '#7c3aed' : '#059669',
                    }}>{s.plan_name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                      background: s.status === 'active' ? '#ecfdf5' : '#f3f4f6',
                      color: s.status === 'active' ? '#059669' : '#9ca3af',
                    }}>{s.status}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
                    </span>
                  </div>
                </div>
                <button onClick={() => renew(s)} style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none',
                  background: '#ecfdf5', color: '#059669',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}>Renew +30d</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
