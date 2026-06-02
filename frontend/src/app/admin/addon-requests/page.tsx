'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type AddonRequest = {
  id: string; device_id: string; user_id: string;
  relay_key: string; label: string; message: string | null;
  status: string; created_at: string;
  email: string; full_name: string;
  device_uid: string; device_name: string;
};

const RELAY_ICON: Record<string, string> = {
  relay6: '💊', relay7: '💧', relay8: '💧',
};

export default function AddonRequestsPage() {
  const [requests, setRequests] = useState<AddonRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState<string | null>(null);
  const [msg,      setMsg]      = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    api<{ requests: AddonRequest[] }>('/api/relays/requests', { auth: 'admin' })
      .then(r => setRequests(r.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const activate = async (req: AddonRequest) => {
    setBusy(req.id);
    try {
      await api(`/api/relays/${req.device_id}/activate`, {
        method: 'POST', auth: 'admin',
        body: JSON.stringify({ relay_key: req.relay_key, amount_paid: 50, notes: `Activated via addon request ${req.id}` }),
      });
      // Mark request as done
      await api('/api/relays/requests/' + req.id + '/resolve', {
        method: 'POST', auth: 'admin',
      }).catch(() => {});
      setMsg(m => ({ ...m, [req.id]: '✅ Activated!' }));
      setTimeout(() => load(), 1500);
    } catch (e: any) {
      setMsg(m => ({ ...m, [req.id]: '✗ ' + (e.message || 'Failed') }));
    } finally { setBusy(null); }
  };

  const dismiss = async (id: string) => {
    setBusy(id);
    await api('/api/relays/requests/' + id + '/resolve', {
      method: 'POST', auth: 'admin',
    }).catch(() => {});
    load();
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-gray-900 text-lg">⚡ Addon Output Requests</h2>
        <p className="text-sm text-gray-500">Users requesting MediSpray / Extra Zone activation (₹50 each)</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1,2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"/>
              <div className="h-3 bg-gray-200 rounded w-2/3"/>
            </div>
          ))}
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="text-3xl mb-3">🎉</div>
          <div className="font-semibold text-gray-700">No pending requests</div>
          <div className="text-sm text-gray-400 mt-1">All addon requests have been handled</div>
        </div>
      )}

      {!loading && requests.map(req => (
        <div key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{RELAY_ICON[req.relay_key] ?? '⚡'}</span>
              <div>
                <div className="font-bold text-gray-900">{req.label}</div>
                <div className="text-xs text-gray-500">{req.relay_key} · {req.device_name} ({req.device_uid})</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  👤 {req.full_name || req.email} · {req.email}
                </div>
                {req.message && (
                  <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    💬 {req.message}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(req.created_at).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              {msg[req.id] ? (
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  msg[req.id].startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>{msg[req.id]}</span>
              ) : (
                <>
                  <button
                    onClick={() => activate(req)}
                    disabled={busy === req.id}
                    className="text-xs px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    {busy === req.id ? 'Activating…' : '⚡ Activate ₹50'}
                  </button>
                  <button
                    onClick={() => dismiss(req.id)}
                    disabled={busy === req.id}
                    className="text-xs px-4 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
