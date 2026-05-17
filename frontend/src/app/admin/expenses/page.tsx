'use client';
import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────
type Payment = {
  id: string; email: string; full_name: string; amount: string;
  payment_reference: string | null; verification_status: 'pending' | 'verified' | 'rejected';
  created_at: string; subscription_id: string;
};
type Subscription = { id: string; plan_name: string; user_id: string; };
type MgmtExpense = {
  id: string; expense_type: string; category: string | null; description: string;
  receipt_number: string | null; amount: string; expense_date: string;
  notes: string | null; created_at: string;
};

// ── Constants ────────────────────────────────────────────────────────────────
const EXPENSE_TYPES = [
  { id: 'equipment',   label: 'Equipment',   emoji: '🔧', color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'salary',      label: 'Salary',      emoji: '👤', color: '#0284c7', bg: '#e0f2fe' },
  { id: 'maintenance', label: 'Maintenance', emoji: '🛠️', color: '#d97706', bg: '#fffbeb' },
  { id: 'rent',        label: 'Rent',        emoji: '🏠', color: '#059669', bg: '#ecfdf5' },
  { id: 'marketing',   label: 'Marketing',   emoji: '📣', color: '#dc2626', bg: '#fef2f2' },
  { id: 'utilities',   label: 'Utilities',   emoji: '⚡', color: '#0891b2', bg: '#e0f7fa' },
  { id: 'travel',      label: 'Travel',      emoji: '✈️', color: '#7c3aed', bg: '#ede9fe' },
  { id: 'software',    label: 'Software',    emoji: '💻', color: '#374151', bg: '#f3f4f6' },
  { id: 'other',       label: 'Other',       emoji: '📦', color: '#6b7280', bg: '#f9fafb' },
];

const PLAN_COLOR: Record<string, { color: string; bg: string; dark: string; emoji: string }> = {
  basic:    { color: '#059669', bg: '#ecfdf5', dark: '#047857', emoji: '🪴' },
  standard: { color: '#0284c7', bg: '#e0f2fe', dark: '#0369a1', emoji: '🕐' },
  premium:  { color: '#7c3aed', bg: '#f5f3ff', dark: '#6d28d9', emoji: '🌟' },
};
const PLAN_AMOUNT: Record<string, number> = { basic: 249, standard: 349, premium: 499 };

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtINR  = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const monthKey = (d: string) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; };
const monthLabel = (k: string) => { const [y,m]=k.split('-'); return new Date(Number(y),Number(m)-1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'}); };
const today = () => new Date().toISOString().slice(0,10);
const expMeta = (type: string) => EXPENSE_TYPES.find(e => e.id === type) || EXPENSE_TYPES[EXPENSE_TYPES.length-1];

// ── Default form state ───────────────────────────────────────────────────────
const emptyForm = () => ({ expense_type:'equipment', category:'', description:'', receipt_number:'', amount:'', expense_date: today(), notes:'' });

// ════════════════════════════════════════════════════════════════════════════
export default function ExpensesPage() {
  const [payments,      setPayments]      = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [mgmtExpenses,  setMgmtExpenses]  = useState<MgmtExpense[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [pyFilter,      setPyFilter]      = useState<'all'|'verified'|'pending'|'rejected'>('all');
  const [expFilter,     setExpFilter]     = useState<'all'|string>('all');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState(emptyForm());
  const [saving,        setSaving]        = useState(false);
  const [formErr,       setFormErr]       = useState('');
  const [deleting,      setDeleting]      = useState<string|null>(null);
  const [activeTab,     setActiveTab]     = useState<'overview'|'revenue'|'expenses'>('overview');

  const load = async () => {
    setLoading(true);
    const [p, s, e] = await Promise.all([
      api<{ payments: Payment[] }>('/api/admin/payments', { auth: 'admin' }),
      api<{ subscriptions: Subscription[] }>('/api/admin/subscriptions', { auth: 'admin' }),
      api<{ expenses: MgmtExpense[] }>('/api/admin/management-expenses', { auth: 'admin' }),
    ]);
    setPayments(p.payments);
    setSubscriptions(s.subscriptions);
    setMgmtExpenses(e.expenses);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const verified    = payments.filter(p => p.verification_status === 'verified');
    const pending     = payments.filter(p => p.verification_status === 'pending');
    const rejected    = payments.filter(p => p.verification_status === 'rejected');
    const totalRev    = verified.reduce((s, p) => s + Number(p.amount), 0);
    const pendingAmt  = pending.reduce((s, p) => s + Number(p.amount), 0);

    const thisMonth = monthKey(new Date().toISOString());
    const monthRev  = verified.filter(p => monthKey(p.created_at) === thisMonth)
                              .reduce((s, p) => s + Number(p.amount), 0);
    const totalExp  = mgmtExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const monthExp  = mgmtExpenses.filter(e => monthKey(e.expense_date) === thisMonth)
                                  .reduce((s, e) => s + Number(e.amount), 0);
    const netProfit = totalRev - totalExp;
    const monthNet  = monthRev - monthExp;

    // Last 6 months
    const months: string[] = [];
    const now = new Date();
    for (let i=5; i>=0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    const mRev: Record<string,number> = {};
    const mExp: Record<string,number> = {};
    months.forEach(m => { mRev[m]=0; mExp[m]=0; });
    verified.forEach(p => { const k=monthKey(p.created_at); if(k in mRev) mRev[k]+=Number(p.amount); });
    mgmtExpenses.forEach(e => { const k=monthKey(e.expense_date); if(k in mExp) mExp[k]+=Number(e.amount); });

    // Plan counts
    const planCount: Record<string,number> = { basic:0, standard:0, premium:0 };
    subscriptions.filter(s => s.plan_name in planCount).forEach(s => planCount[s.plan_name]++);

    // Expense by type
    const byType: Record<string,number> = {};
    mgmtExpenses.forEach(e => { byType[e.expense_type] = (byType[e.expense_type]||0) + Number(e.amount); });

    return { verified, pending, rejected, totalRev, pendingAmt, monthRev, totalExp, monthExp, netProfit, monthNet, months, mRev, mExp, planCount, byType };
  }, [payments, subscriptions, mgmtExpenses]);

  const maxBar = Math.max(...stats.months.map(m => Math.max(stats.mRev[m], stats.mExp[m])), 1);
  const getPlan = (subId: string) => subscriptions.find(s => s.id === subId)?.plan_name || 'basic';

  // ── Add expense ─────────────────────────────────────────────────────────────
  const submitExpense = async () => {
    if (!form.description.trim()) return setFormErr('Description is required');
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) return setFormErr('Enter a valid amount');
    if (!form.expense_date) return setFormErr('Select a date');
    setSaving(true); setFormErr('');
    try {
      await api('/api/admin/management-expenses', {
        method: 'POST', auth: 'admin',
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setShowModal(false);
      setForm(emptyForm());
      await load();
    } catch (e: any) { setFormErr(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense record?')) return;
    setDeleting(id);
    try {
      await api(`/api/admin/management-expenses/${id}`, { method: 'DELETE', auth: 'admin' });
      setMgmtExpenses(prev => prev.filter(e => e.id !== id));
    } finally { setDeleting(null); }
  };

  const filteredPay = pyFilter === 'all' ? payments : payments.filter(p => p.verification_status === pyFilter);
  const filteredExp = expFilter === 'all' ? mgmtExpenses : mgmtExpenses.filter(e => e.expense_type === expFilter);

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:'#9ca3af', fontSize:14 }}>Loading finances…</div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .ec{animation:fadeUp .35s ease both}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:24px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto}
        .inp{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:13px;outline:none;box-sizing:border-box;font-family:inherit;background:#fff}
        .inp:focus{border-color:#059669;box-shadow:0 0 0 3px rgba(5,150,105,0.1)}
        select.inp{appearance:none;cursor:pointer}
        .tab-btn{padding:8px 16px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:'#0f172a', letterSpacing:'-0.03em' }}>💰 Finances</div>
          <div style={{ fontSize:13, color:'#94a3b8', marginTop:2 }}>Revenue · Expenses · P&L</div>
        </div>
        <button onClick={() => { setShowModal(true); setForm(emptyForm()); setFormErr(''); }} style={{
          padding:'10px 18px', borderRadius:50, border:'none',
          background:'linear-gradient(135deg,#059669,#047857)',
          color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer',
          boxShadow:'0 4px 14px rgba(5,150,105,0.35)',
        }}>
          + Add Expense
        </button>
      </div>

      {/* ── P&L KPI Strip ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        <div className="ec" style={{ borderRadius:18, padding:'16px 18px', background:'linear-gradient(135deg,#059669,#047857)', color:'#fff', boxShadow:'0 6px 20px rgba(5,150,105,0.3)', animationDelay:'0s' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Total Revenue</div>
          <div style={{ fontSize:24, fontWeight:900, letterSpacing:'-0.04em' }}>{fmtINR(stats.totalRev)}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:2 }}>{stats.verified.length} verified payments</div>
        </div>
        <div className="ec" style={{ borderRadius:18, padding:'16px 18px', background:'linear-gradient(135deg,#dc2626,#b91c1c)', color:'#fff', boxShadow:'0 6px 20px rgba(220,38,38,0.3)', animationDelay:'0.07s' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Total Expenses</div>
          <div style={{ fontSize:24, fontWeight:900, letterSpacing:'-0.04em' }}>{fmtINR(stats.totalExp)}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:2 }}>{mgmtExpenses.length} expense records</div>
        </div>
        <div className="ec" style={{ borderRadius:18, padding:'16px 18px', background: stats.netProfit >= 0 ? 'linear-gradient(135deg,#0284c7,#0369a1)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', boxShadow: stats.netProfit >= 0 ? '0 6px 20px rgba(2,132,199,0.3)' : '0 6px 20px rgba(217,119,6,0.3)', animationDelay:'0.14s' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Net Profit</div>
          <div style={{ fontSize:24, fontWeight:900, letterSpacing:'-0.04em' }}>{stats.netProfit >= 0 ? '' : '-'}{fmtINR(Math.abs(stats.netProfit))}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:2 }}>This month: {stats.monthNet >= 0 ? '+' : ''}{fmtINR(stats.monthNet)}</div>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'This Month Revenue', val: fmtINR(stats.monthRev), icon:'📅', color:'#059669' },
          { label:'This Month Expenses', val: fmtINR(stats.monthExp), icon:'📋', color:'#dc2626' },
          { label:'Pending Collection', val: fmtINR(stats.pendingAmt), icon:'⏳', color:'#d97706' },
        ].map((k,i) => (
          <div key={k.label} className="ec" style={{ borderRadius:16, padding:'14px 16px', background:'#fff', border:'1.5px solid #e2e8f0', animationDelay:`${0.21+i*0.06}s` }}>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize:20, fontWeight:900, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {([['overview','📊 Overview'],['revenue','💚 Revenue'],['expenses','🔴 Expenses']] as const).map(([id,lbl]) => (
          <button key={id} onClick={() => setActiveTab(id)} className="tab-btn" style={{
            background: activeTab===id ? '#1f2937' : '#f3f4f6',
            color: activeTab===id ? '#fff' : '#6b7280',
          }}>{lbl}</button>
        ))}
      </div>

      {/* ══════════ OVERVIEW TAB ══════════ */}
      {activeTab === 'overview' && (
        <div>
          {/* Monthly P&L Chart */}
          <div className="ec" style={{ borderRadius:20, background:'#fff', padding:'18px 20px', border:'1.5px solid #e2e8f0', marginBottom:14, animationDelay:'0.3s' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#1f2937', marginBottom:6 }}>Monthly P&L — Last 6 Months</div>
            <div style={{ display:'flex', gap:16, marginBottom:12 }}>
              <span style={{ fontSize:11, color:'#059669', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:10, height:10, borderRadius:3, background:'#059669', display:'inline-block' }}/> Revenue
              </span>
              <span style={{ fontSize:11, color:'#dc2626', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:10, height:10, borderRadius:3, background:'#dc2626', display:'inline-block' }}/> Expenses
              </span>
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:110 }}>
              {stats.months.map((m, i) => {
                const r = stats.mRev[m]; const e = stats.mExp[m];
                const rPct = (r/maxBar)*90; const ePct = (e/maxBar)*90;
                const isThis = i===stats.months.length-1;
                return (
                  <div key={m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                    <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:88 }}>
                      <div style={{ flex:1, height:`${Math.max(rPct,r>0?4:1)}%`, background: isThis?'#059669':'#86efac', borderRadius:'4px 4px 0 0', transition:'height .6s ease' }}/>
                      <div style={{ flex:1, height:`${Math.max(ePct,e>0?4:1)}%`, background: isThis?'#dc2626':'#fca5a5', borderRadius:'4px 4px 0 0', transition:'height .6s ease' }}/>
                    </div>
                    <div style={{ fontSize:9, color: isThis?'#1f2937':'#9ca3af', fontWeight: isThis?800:600 }}>{monthLabel(m)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan + Expense type breakdown */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {/* Subscribers */}
            <div className="ec" style={{ borderRadius:20, background:'#fff', padding:'16px 18px', border:'1.5px solid #e2e8f0', animationDelay:'0.36s' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#1f2937', marginBottom:12 }}>Active Subscribers</div>
              {(['basic','standard','premium'] as const).map(plan => {
                const meta = PLAN_COLOR[plan];
                const count = stats.planCount[plan];
                const maxC = Math.max(...Object.values(stats.planCount),1);
                return (
                  <div key={plan} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{meta.emoji} {plan.charAt(0).toUpperCase()+plan.slice(1)}</span>
                      <span style={{ fontSize:11, color:'#6b7280' }}>{count} · {fmtINR(count*PLAN_AMOUNT[plan])}/mo</span>
                    </div>
                    <div style={{ background:'#f1f5f9', borderRadius:99, height:5 }}>
                      <div style={{ height:'100%', borderRadius:99, background:`linear-gradient(90deg,${meta.color},${meta.dark})`, width:`${(count/maxC)*100}%`, transition:'width .5s ease' }}/>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid #f1f5f9', fontSize:12, color:'#6b7280' }}>
                MRR: <strong style={{ color:'#059669' }}>{fmtINR(stats.planCount.basic*249+stats.planCount.standard*349+stats.planCount.premium*499)}</strong>
              </div>
            </div>

            {/* Expense by type */}
            <div className="ec" style={{ borderRadius:20, background:'#fff', padding:'16px 18px', border:'1.5px solid #e2e8f0', animationDelay:'0.42s' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#1f2937', marginBottom:12 }}>Expenses by Type</div>
              {Object.keys(stats.byType).length === 0 ? (
                <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'20px 0' }}>No expenses recorded yet</div>
              ) : (
                Object.entries(stats.byType).sort((a,b)=>b[1]-a[1]).map(([type, amt]) => {
                  const m = expMeta(type);
                  const total = stats.totalExp || 1;
                  return (
                    <div key={type} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{m.emoji} {m.label}</span>
                        <span style={{ fontSize:11, color:'#6b7280' }}>{fmtINR(amt)} ({Math.round((amt/total)*100)}%)</span>
                      </div>
                      <div style={{ background:'#f1f5f9', borderRadius:99, height:5 }}>
                        <div style={{ height:'100%', borderRadius:99, background:m.color, width:`${(amt/total)*100}%`, transition:'width .5s ease' }}/>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ REVENUE TAB ══════════ */}
      {activeTab === 'revenue' && (
        <div className="ec" style={{ borderRadius:20, background:'#fff', border:'1.5px solid #e2e8f0', overflow:'hidden', animationDelay:'0.1s' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#1f2937' }}>Payment Records</div>
            <div style={{ display:'flex', gap:6 }}>
              {(['all','verified','pending','rejected'] as const).map(f => (
                <button key={f} onClick={() => setPyFilter(f)} style={{
                  padding:'5px 12px', borderRadius:20, border:'none',
                  background: pyFilter===f ? '#1f2937' : '#f3f4f6',
                  color: pyFilter===f ? '#fff' : '#6b7280',
                  fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'capitalize',
                }}>{f}</button>
              ))}
            </div>
          </div>
          {filteredPay.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>No payments found</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['Customer','Plan','Amount','Reference','Status','Date'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPay.map((p,i) => {
                    const plan = getPlan(p.subscription_id);
                    const pm = PLAN_COLOR[plan] || PLAN_COLOR.basic;
                    const sc = { verified:{color:'#059669',bg:'#ecfdf5'}, pending:{color:'#d97706',bg:'#fffbeb'}, rejected:{color:'#dc2626',bg:'#fef2f2'} }[p.verification_status];
                    return (
                      <tr key={p.id} style={{ borderBottom: i<filteredPay.length-1?'1px solid #f8fafc':'none', background: i%2===0?'#fff':'#fafbfd' }}>
                        <td style={{ padding:'11px 14px' }}>
                          <div style={{ fontWeight:700, fontSize:13, color:'#1f2937' }}>{p.full_name}</div>
                          <div style={{ fontSize:11, color:'#9ca3af' }}>{p.email}</div>
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:pm.bg, color:pm.color }}>
                            {pm.emoji} {plan.charAt(0).toUpperCase()+plan.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding:'11px 14px', fontWeight:800, fontSize:14, color:'#1f2937' }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                        <td style={{ padding:'11px 14px', fontSize:12, color:'#6b7280', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.payment_reference || <span style={{ color:'#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:sc.bg, color:sc.color, textTransform:'capitalize' }}>
                            {p.verification_status==='verified'?'✓ ':p.verification_status==='pending'?'⏳ ':'✗ '}{p.verification_status}
                          </span>
                        </td>
                        <td style={{ padding:'11px 14px', fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>
                          {new Date(p.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Footer */}
          <div style={{ padding:'12px 18px', background:'#f8fafc', borderTop:'1px solid #f1f5f9', display:'flex', gap:20, flexWrap:'wrap', fontSize:12, color:'#6b7280' }}>
            <span>Total: <strong style={{color:'#1f2937'}}>{payments.length}</strong></span>
            <span>Verified: <strong style={{color:'#059669'}}>{stats.verified.length}</strong></span>
            <span>Pending: <strong style={{color:'#d97706'}}>{stats.pending.length}</strong></span>
            <span>Rejected: <strong style={{color:'#dc2626'}}>{stats.rejected.length}</strong></span>
            <span style={{marginLeft:'auto'}}>Success rate: <strong style={{color:'#1f2937'}}>{payments.length?Math.round((stats.verified.length/payments.length)*100):0}%</strong></span>
          </div>
        </div>
      )}

      {/* ══════════ EXPENSES TAB ══════════ */}
      {activeTab === 'expenses' && (
        <div>
          {/* Type filter */}
          <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
            <button onClick={() => setExpFilter('all')} style={{ padding:'5px 14px', borderRadius:20, border:'none', background: expFilter==='all'?'#1f2937':'#f3f4f6', color: expFilter==='all'?'#fff':'#6b7280', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              All ({mgmtExpenses.length})
            </button>
            {EXPENSE_TYPES.filter(t => mgmtExpenses.some(e => e.expense_type===t.id)).map(t => (
              <button key={t.id} onClick={() => setExpFilter(t.id)} style={{ padding:'5px 14px', borderRadius:20, border:'none', background: expFilter===t.id?t.color:'#f3f4f6', color: expFilter===t.id?'#fff':'#6b7280', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {t.emoji} {t.label} ({mgmtExpenses.filter(e=>e.expense_type===t.id).length})
              </button>
            ))}
          </div>

          {filteredExp.length === 0 ? (
            <div style={{ borderRadius:20, padding:'50px 24px', textAlign:'center', background:'#f9fafb', border:'2px dashed #e5e7eb' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
              <div style={{ fontSize:14, color:'#6b7280', fontWeight:600, marginBottom:6 }}>No expense records yet</div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>Click "+ Add Expense" to log your first management expense</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filteredExp.map((e, i) => {
                const meta = expMeta(e.expense_type);
                return (
                  <div key={e.id} className="ec" style={{ animationDelay:`${i*0.05}s`, borderRadius:18, background:'#fff', border:`1.5px solid ${meta.color}22`, padding:'14px 18px', display:'flex', gap:14, alignItems:'flex-start' }}>
                    {/* Type badge */}
                    <div style={{ width:42, height:42, borderRadius:14, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {meta.emoji}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                        <span style={{ fontWeight:800, fontSize:14, color:'#1f2937' }}>{e.description}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:meta.bg, color:meta.color, textTransform:'capitalize' }}>
                          {meta.label}
                        </span>
                        {e.category && (
                          <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#f3f4f6', color:'#6b7280' }}>{e.category}</span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'#6b7280' }}>
                        <span>📅 {new Date(e.expense_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
                        {e.receipt_number && <span>🧾 {e.receipt_number}</span>}
                        {e.notes && <span>💬 {e.notes}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontWeight:900, fontSize:18, color:'#dc2626', letterSpacing:'-0.03em' }}>
                        {fmtINR(Number(e.amount))}
                      </div>
                      <button onClick={() => deleteExpense(e.id)} disabled={deleting===e.id} style={{
                        marginTop:6, padding:'4px 10px', borderRadius:8, border:'none',
                        background:'#fef2f2', color:'#dc2626', fontSize:11, fontWeight:700,
                        cursor: deleting===e.id ? 'not-allowed' : 'pointer', opacity: deleting===e.id ? 0.5 : 1,
                      }}>
                        {deleting===e.id ? '…' : '🗑 Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary bar */}
          {filteredExp.length > 0 && (
            <div style={{ marginTop:14, padding:'12px 18px', borderRadius:16, background:'#fef2f2', border:'1.5px solid #fecaca', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <span style={{ fontSize:13, color:'#6b7280' }}>
                Showing <strong style={{color:'#1f2937'}}>{filteredExp.length}</strong> expense{filteredExp.length!==1?'s':''}
              </span>
              <span style={{ fontSize:14, fontWeight:900, color:'#dc2626' }}>
                Total: {fmtINR(filteredExp.reduce((s,e)=>s+Number(e.amount),0))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ══════════ ADD EXPENSE MODAL ══════════ */}
      {showModal && (
        <div className="modal-bg" onClick={e => { if(e.target===e.currentTarget){ setShowModal(false); } }}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:900, color:'#0f172a' }}>📋 Add Expense</div>
              <button onClick={() => setShowModal(false)} style={{ border:'none', background:'#f3f4f6', borderRadius:10, width:30, height:30, cursor:'pointer', fontSize:16, color:'#6b7280' }}>✕</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Expense type */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>Expense Type *</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {EXPENSE_TYPES.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({...f, expense_type:t.id}))} style={{
                      padding:'6px 12px', borderRadius:20, border:`1.5px solid ${form.expense_type===t.id ? t.color : '#e2e8f0'}`,
                      background: form.expense_type===t.id ? t.bg : '#fff',
                      color: form.expense_type===t.id ? t.color : '#6b7280',
                      fontSize:12, fontWeight:700, cursor:'pointer',
                    }}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>Description *</div>
                <input className="inp" placeholder="e.g. Water pump replacement, Monthly salary…" value={form.description}
                  onChange={e => setForm(f=>({...f,description:e.target.value}))} />
              </div>

              {/* Amount + Date */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>Amount (₹) *</div>
                  <input className="inp" type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} />
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>Date *</div>
                  <input className="inp" type="date" value={form.expense_date}
                    onChange={e => setForm(f=>({...f,expense_date:e.target.value}))} />
                </div>
              </div>

              {/* Category + Receipt */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>Category</div>
                  <input className="inp" placeholder="e.g. Hardware, Operations…" value={form.category}
                    onChange={e => setForm(f=>({...f,category:e.target.value}))} />
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>Receipt No.</div>
                  <input className="inp" placeholder="e.g. INV-2024-001" value={form.receipt_number}
                    onChange={e => setForm(f=>({...f,receipt_number:e.target.value}))} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:6 }}>Notes</div>
                <textarea className="inp" rows={2} placeholder="Additional details…" value={form.notes}
                  onChange={e => setForm(f=>({...f,notes:e.target.value}))} style={{ resize:'vertical' }}/>
              </div>

              {formErr && <div style={{ fontSize:12, color:'#dc2626', fontWeight:600 }}>⚠️ {formErr}</div>}

              <button onClick={submitExpense} disabled={saving} style={{
                padding:'13px 0', borderRadius:50, border:'none',
                background: saving?'#e2e8f0':'linear-gradient(135deg,#059669,#047857)',
                color: saving?'#9ca3af':'#fff', fontWeight:800, fontSize:14,
                cursor: saving?'not-allowed':'pointer',
                boxShadow: saving?'none':'0 4px 14px rgba(5,150,105,0.35)',
              }}>
                {saving ? '⏳ Saving…' : '✅ Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
