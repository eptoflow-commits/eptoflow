'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type User = {
  id: string; full_name: string; email: string; phone: string | null;
  status: string; created_at: string;
  plan_name: string | null; sub_status: string | null; end_date: string | null;
  sub_id: string | null; days_left: number | null;
};

function DaysBar({ days }: { days: number | null }) {
  if (days === null) return <span style={{ fontSize: 11, color: '#9ca3af' }}>No plan</span>;
  const pct = Math.min(100, Math.round((days / 365) * 100));
  const color = days <= 15 ? '#dc2626' : days <= 60 ? '#d97706' : '#059669';
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{days}d left</span>
      </div>
      <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }}/>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers]         = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]     = useState<User | null>(null);
  const [renewTarget, setRenewTarget] = useState<User | null>(null);
  const [renewDays, setRenewDays] = useState(365);
  const [renewPlan, setRenewPlan] = useState<'basic'|'premium'>('basic');
  const [form, setForm]           = useState({ full_name: '', email: '', phone: '', password: '' });
  const [editForm, setEditForm]   = useState({ full_name: '', email: '', phone: '' });
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [msg, setMsg]             = useState<string | null>(null);

  const load = async () => {
    const { users } = await api<{ users: User[] }>('/api/admin/users', { auth: 'admin' });
    setUsers(users);
  };
  useEffect(() => { load(); }, []);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  /* ── Create user ── */
  const createUser = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await api<{ user: User }>('/api/admin/users/create', {
        method: 'POST', auth: 'admin', body: JSON.stringify(form),
      });
      setMsg(`✅ User ${r.user.email} created`);
      setForm({ full_name: '', email: '', phone: '', password: '' });
      setShowCreate(false);
      load();
    } catch (e: any) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  /* ── Edit user ── */
  const openEdit = (u: User) => {
    setEditing(u);
    setEditForm({ full_name: u.full_name, email: u.email, phone: u.phone || '' });
    setErr(null);
  };
  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true); setErr(null);
    try {
      await api(`/api/admin/users/${editing.id}`, {
        method: 'PATCH', auth: 'admin',
        body: JSON.stringify({ full_name: editForm.full_name, email: editForm.email, phone: editForm.phone || null }),
      });
      setMsg('✅ User updated');
      setEditing(null);
      load();
    } catch (e: any) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  /* ── Toggle status ── */
  const toggle = async (u: User) => {
    const next = u.status === 'active' ? 'suspended' : 'active';
    await api(`/api/admin/users/${u.id}/status`, { method: 'POST', auth: 'admin', body: JSON.stringify({ status: next }) });
    load();
  };

  /* ── Renew subscription ── */
  const doRenew = async () => {
    if (!renewTarget) return;
    setBusy(true); setErr(null);
    try {
      await api('/api/admin/subscriptions/renew', {
        method: 'POST', auth: 'admin',
        body: JSON.stringify({
          user_id: renewTarget.id,
          plan: renewPlan,
          subscription_id: renewTarget.sub_id || undefined,
          days: renewDays,
        }),
      });
      setMsg(`✅ ${renewPlan} plan activated for ${renewDays} days`);
      setRenewTarget(null);
      load();
    } catch (e: any) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const DAY_PRESETS = [30, 90, 180, 365];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1f2937' }}>👥 Users ({users.length})</div>
        <button onClick={() => { setShowCreate(!showCreate); setErr(null); setMsg(null); }} style={{
          padding: '8px 16px', borderRadius: 10, border: 'none',
          background: showCreate ? '#f3f4f6' : 'linear-gradient(135deg,#059669,#047857)',
          color: showCreate ? '#6b7280' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>{showCreate ? '✕ Cancel' : '+ Create User'}</button>
      </div>

      {msg && <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#065f46' }}>{msg}</div>}

      {/* ── Create form ── */}
      {showCreate && (
        <form onSubmit={createUser} style={{ background: '#fff', borderRadius: 16, padding: 18, border: '1.5px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1f2937', marginBottom: 14 }}>Create New User</div>
          {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 10 }}>⚠️ {err}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[
              { k: 'full_name', l: 'Full Name', t: 'text' },
              { k: 'email', l: 'Email', t: 'email' },
              { k: 'phone', l: 'Phone', t: 'tel' },
              { k: 'password', l: 'Password', t: 'password' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.l}</label>
                <input type={f.t} required={f.k !== 'phone'} value={form[f.k as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, color: '#1f2937', background: '#f9fafb', outline: 'none', boxSizing: 'border-box' }}/>
              </div>
            ))}
          </div>
          <button type="submit" disabled={busy} style={{
            padding: '9px 20px', borderRadius: 10, border: 'none',
            background: busy ? '#e5e7eb' : 'linear-gradient(135deg,#059669,#047857)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
          }}>{busy ? 'Creating…' : 'Create User'}</button>
        </form>
      )}

      {/* ── User cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map(u => (
          <div key={u.id} style={{
            background: '#fff', borderRadius: 14, padding: '12px 16px',
            border: `1.5px solid ${u.status !== 'active' ? '#fca5a5' : u.days_left !== null && u.days_left <= 15 ? '#fcd34d' : '#e5e7eb'}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#1f2937' }}>{u.full_name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
                    background: u.status === 'active' ? '#ecfdf5' : '#fef2f2',
                    color: u.status === 'active' ? '#059669' : '#dc2626',
                  }}>{u.status}</span>
                  {u.plan_name && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                      background: u.plan_name === 'premium' ? '#f5f3ff' : '#ecfdf5',
                      color: u.plan_name === 'premium' ? '#7c3aed' : '#059669',
                    }}>{u.plan_name}</span>
                  )}
                </div>

                {/* Contact */}
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>📧 {u.email}</div>
                {u.phone && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>📱 {u.phone}</div>}

                {/* Days remaining bar */}
                <div style={{ marginTop: 6 }}>
                  <DaysBar days={u.sub_status === 'active' ? u.days_left : null}/>
                  {u.end_date && u.sub_status === 'active' && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                      Expires {fmtDate(u.end_date)}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                <button onClick={() => openEdit(u)} style={{
                  padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                  background: '#f9fafb', color: '#374151',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>✏️ Edit</button>
                <button onClick={() => { setRenewTarget(u); setRenewPlan((u.plan_name as any) || 'basic'); setErr(null); }} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: '#ecfdf5', color: '#059669',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>📅 Set Plan</button>
                <button onClick={() => toggle(u)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: u.status === 'active' ? '#fef2f2' : '#ecfdf5',
                  color: u.status === 'active' ? '#dc2626' : '#059669',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 40 }}>No users yet</div>
        )}
      </div>

      {/* ── Edit user modal ── */}
      {editing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 100, padding: '0 16px 16px',
        }} onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 480 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', marginBottom: 14 }}>✏️ Edit User</div>
            {err && <div style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 10 }}>⚠️ {err}</div>}
            {[
              { k: 'full_name', l: 'Full Name', t: 'text' },
              { k: 'email', l: 'Email', t: 'email' },
              { k: 'phone', l: 'Phone', t: 'tel' },
            ].map(f => (
              <div key={f.k} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.l}</label>
                <input type={f.t} value={editForm[f.k as keyof typeof editForm]}
                  onChange={e => setEditForm(p => ({ ...p, [f.k]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#1f2937', background: '#f9fafb', outline: 'none', boxSizing: 'border-box' }}/>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} disabled={busy} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                background: busy ? '#e5e7eb' : 'linear-gradient(135deg,#059669,#047857)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
              }}>{busy ? 'Saving…' : 'Save Changes'}</button>
              <button onClick={() => setEditing(null)} style={{
                padding: '11px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb',
                background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set Plan modal ── */}
      {renewTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 100, padding: '0 16px 16px',
        }} onClick={e => { if (e.target === e.currentTarget) setRenewTarget(null); }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 480 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>📅 Set Plan</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>{renewTarget.full_name} · {renewTarget.email}</div>

            {err && <div style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 10 }}>⚠️ {err}</div>}

            {/* Plan */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Plan</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['basic', 'premium'] as const).map(p => (
                  <button key={p} type="button" onClick={() => setRenewPlan(p)} style={{
                    padding: '10px 8px', borderRadius: 10, border: `2px solid ${renewPlan === p ? (p === 'premium' ? '#7c3aed' : '#059669') : '#e5e7eb'}`,
                    background: renewPlan === p ? (p === 'premium' ? '#f5f3ff' : '#ecfdf5') : '#f9fafb',
                    color: renewPlan === p ? (p === 'premium' ? '#7c3aed' : '#059669') : '#6b7280',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
                  }}>{p === 'premium' ? '🌟 Premium ₹499' : '🪴 Basic ₹249'}</button>
                ))}
              </div>
            </div>

            {/* Days */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Duration (from today)</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {DAY_PRESETS.map(d => (
                  <button key={d} type="button" onClick={() => setRenewDays(d)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    background: renewDays === d ? '#1f2937' : '#f3f4f6',
                    color: renewDays === d ? '#fff' : '#6b7280',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>{d < 365 ? `${d}d` : '1yr'}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={1} max={3650} value={renewDays}
                  onChange={e => setRenewDays(Number(e.target.value))}
                  style={{ width: 80, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, fontWeight: 700, color: '#1f2937', background: '#f9fafb', outline: 'none' }}/>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  days → expires {new Date(Date.now() + renewDays * 86400000).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={doRenew} disabled={busy} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                background: busy ? '#e5e7eb' : 'linear-gradient(135deg,#059669,#047857)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
              }}>{busy ? 'Activating…' : `Activate ${renewPlan} · ${renewDays} days`}</button>
              <button onClick={() => setRenewTarget(null)} style={{
                padding: '11px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb',
                background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
