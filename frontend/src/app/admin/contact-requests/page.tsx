'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type ContactRequest = {
  id: string; full_name: string; email: string; phone: string;
  plan: string; message: string | null; status: string; created_at: string;
};

const PLAN_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  basic:          { label: 'Basic ₹249',    icon: '🪴', color: '#059669', bg: '#ecfdf5' },
  standard:       { label: 'Standard ₹349', icon: '🕐', color: '#0284c7', bg: '#e0f2fe' },
  premium:        { label: 'Premium ₹499',  icon: '🌟', color: '#7c3aed', bg: '#f5f3ff' },
  custom:         { label: 'Custom',        icon: '⚙️', color: '#d97706', bg: '#fffbeb' },
  password_reset: { label: 'Password Reset',icon: '🔑', color: '#dc2626', bg: '#fef2f2' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'New',       color: '#dc2626', bg: '#fef2f2' },
  contacted: { label: 'Contacted', color: '#d97706', bg: '#fffbeb' },
  done:      { label: 'Done',      color: '#059669', bg: '#ecfdf5' },
};

export default function ContactRequestsPage() {
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    try {
      const d = await api<{ contact_requests: ContactRequest[] }>(
        '/api/admin/contact-requests', { auth: 'admin' }
      );
      setRequests(d.contact_requests);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await api(`/api/admin/contact-requests/${id}`, {
      method: 'PATCH', auth: 'admin',
      body: JSON.stringify({ status }),
    });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const newCount = requests.filter(r => r.status === 'new').length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937' }}>
          📬 Contact Requests
          {newCount > 0 && (
            <span style={{
              marginLeft: 8, background: '#dc2626', color: '#fff',
              fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
            }}>{newCount} new</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
          Users who requested access from the signup page
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'new', 'contacted', 'done'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none',
            background: filter === f ? '#1f2937' : '#f3f4f6',
            color: filter === f ? '#fff' : '#6b7280',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
          }}>{f === 'all' ? `All (${requests.length})` : `${f} (${requests.filter(r => r.status === f).length})`}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#f9fafb', borderRadius: 16, padding: '40px 24px',
          textAlign: 'center', border: '2px dashed #e5e7eb',
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>No requests yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => {
            const pm = PLAN_META[r.plan] || PLAN_META.basic;
            const sm = STATUS_META[r.status] || STATUS_META.new;
            return (
              <div key={r.id} style={{
                background: '#fff', borderRadius: 14, padding: '14px 16px',
                border: `1.5px solid ${r.status === 'new' ? '#fca5a5' : '#e5e7eb'}`,
                boxShadow: r.status === 'new' ? '0 2px 12px rgba(220,38,38,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name + status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#1f2937' }}>{r.full_name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: sm.bg, color: sm.color, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{sm.label}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: pm.bg, color: pm.color,
                      }}>{pm.icon} {pm.label}</span>
                    </div>

                    {/* Contact info */}
                    <div style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}>
                      📧 <a href={`mailto:${r.email}`} style={{ color: '#059669', fontWeight: 600 }}>{r.email}</a>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', marginBottom: r.message ? 8 : 0 }}>
                      📱 <a href={`tel:${r.phone}`} style={{ color: '#059669', fontWeight: 600 }}>{r.phone}</a>
                    </div>

                    {r.message && (
                      <div style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 8,
                        background: '#f9fafb', border: '1px solid #e5e7eb',
                        fontSize: 12, color: '#6b7280', lineHeight: 1.5,
                      }}>
                        💬 {r.message}
                      </div>
                    )}

                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                      {fmtDate(r.created_at)}
                    </div>
                  </div>

                  {/* Status actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {r.status !== 'contacted' && (
                      <button onClick={() => updateStatus(r.id, 'contacted')} style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: '#fffbeb', color: '#d97706',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}>📞 Contacted</button>
                    )}
                    {r.status !== 'done' && (
                      <button onClick={() => updateStatus(r.id, 'done')} style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: '#ecfdf5', color: '#059669',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}>✅ Done</button>
                    )}
                    {r.status !== 'new' && (
                      <button onClick={() => updateStatus(r.id, 'new')} style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: '#f3f4f6', color: '#6b7280',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>↩ Reopen</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
