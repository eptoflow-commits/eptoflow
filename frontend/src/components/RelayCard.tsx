'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * RelayCard — shows all 8 relays with correct access control
 *
 * - relay1-4 (valve1-3 + motor): always visible, instantly controllable
 * - relay5 (WiFi): read-only status indicator
 * - relay6-8 (premium add-ons): hidden until activated by admin
 *
 * Shows activation status + ₹50 CTA for locked relays.
 * Manual control buttons send commands via /api/devices/:id/commands.
 */

type RelayLicense = {
  relay_key:    string;
  activated:    boolean;
  activated_at: string | null;
  amount_paid:  number;
  label:        string;
  price_inr:    number;
};

type RelayState = Record<string, boolean>;

type Props = {
  deviceId:   string;
  isPremium:  boolean;
  zoneNames?: Record<string, string>;
  onCommand?: () => void;
};

const FRIENDLY_LABELS: Record<string, string> = {
  relay6: 'MediSpray', relay7: 'Extra Zone 1', relay8: 'Extra Zone 2',
};

const CORE_RELAYS = [
  { key: 'valve1', label: 'Daily Watering',      icon: '🌿', type: 'valve' },
  { key: 'valve2', label: 'Occasional Watering', icon: '🌱', type: 'valve' },
  { key: 'valve3', label: 'Misting',             icon: '🌊', type: 'valve' },
  { key: 'relay1', label: 'Motor / Light',       icon: '⚙️', type: 'relay' },
];

function LockedOutputs({ deviceId, lockedPremium }: { deviceId: string; lockedPremium: RelayLicense[] }) {
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [busy, setBusy]           = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [msgs, setMsgs]           = useState<Record<string, string>>({});

  const request = async (relayKey: string, msg: string) => {
    setBusy(relayKey);
    try {
      await api(`/api/relays/${deviceId}/request`, {
        method: 'POST',
        body: JSON.stringify({ relay_key: relayKey, message: msg }),
      });
      setRequested(r => ({ ...r, [relayKey]: true }));
      setExpanded(null);
    } catch {
      setRequested(r => ({ ...r, [relayKey]: false }));
    } finally { setBusy(null); }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg,#fdf4ff,#f5f3ff)',
      border: '1.5px solid #e9d5ff', borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#6d28d9' }}>
            {lockedPremium.length} Extra Output{lockedPremium.length > 1 ? 's' : ''} Available
          </div>
          <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 1 }}>₹50 each · Includes smart automation</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lockedPremium.map((lic) => {
          const label = FRIENDLY_LABELS[lic.relay_key] ?? lic.label;
          const icon  = lic.relay_key === 'relay6' ? '💊' : '💧';
          const done  = requested[lic.relay_key];
          const open  = expanded === lic.relay_key;

          return (
            <div key={lic.relay_key} style={{
              background: '#fff', borderRadius: 10, border: '1px solid #ede9fe', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>₹50 to activate</div>
                  </div>
                </div>
                {done ? (
                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ Requested</span>
                ) : (
                  <button onClick={() => setExpanded(open ? null : lic.relay_key)} style={{
                    background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>Request</button>
                )}
              </div>

              {open && !done && (
                <RequestForm
                  label={label}
                  busy={busy === lic.relay_key}
                  msg={msgs[lic.relay_key] ?? ''}
                  onMsg={v => setMsgs(m => ({ ...m, [lic.relay_key]: v }))}
                  onSubmit={() => request(lic.relay_key, msgs[lic.relay_key] ?? '')}
                  onCancel={() => setExpanded(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RequestForm({ label, busy, msg, onMsg, onSubmit, onCancel }: {
  label: string; busy: boolean; msg: string;
  onMsg: (v: string) => void; onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ padding: '0 12px 12px', borderTop: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 10, marginBottom: 6 }}>
        Send a request to your admin to activate <strong>{label}</strong>:
      </div>
      <textarea
        value={msg}
        onChange={e => onMsg(e.target.value)}
        placeholder="Optional: add a note (e.g. plant type, location…)"
        rows={2}
        style={{
          width: '100%', borderRadius: 8, border: '1.5px solid #e9d5ff',
          padding: '7px 10px', fontSize: 12, resize: 'none',
          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onSubmit} disabled={busy} style={{
          flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
          background: busy ? '#e5e7eb' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
          color: busy ? '#9ca3af' : '#fff', fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
        }}>{busy ? 'Sending…' : 'Send Request'}</button>
        <button onClick={onCancel} style={{
          padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
          background: '#fff', fontSize: 12, color: '#6b7280', cursor: 'pointer',
        }}>Cancel</button>
      </div>
    </div>
  );
}

export default function RelayCard({ deviceId, isPremium, zoneNames = {}, onCommand }: Props) {
  const [licenses, setLicenses] = useState<RelayLicense[]>([]);
  const [state,    setState]    = useState<RelayState>({});
  const [loading,  setLoading]  = useState<string | null>(null);

  useEffect(() => {
    if (isPremium) {
      api<{ licenses: RelayLicense[] }>(`/api/relays/${deviceId}/licenses`)
        .then((r) => setLicenses(r.licenses))
        .catch(() => {});
    }
  }, [deviceId, isPremium]);

  const sendCommand = async (commandType: string, target: string, duration?: number) => {
    setLoading(target);
    try {
      await api(`/api/devices/${deviceId}/commands`, {
        method: 'POST',
        body: JSON.stringify({
          command_type: commandType,
          payload: { target, ...(duration ? { duration } : {}) },
          source: 'manual',
        }),
      });
      setState((s) => ({ ...s, [target]: commandType !== 'valve_off' && commandType !== 'relay_off' }));
      onCommand?.();
    } catch {}
    finally { setLoading(null); }
  };

  const stopAll = async () => {
    setLoading('stop_all');
    try {
      await api(`/api/devices/${deviceId}/commands`, {
        method: 'POST',
        body: JSON.stringify({ command_type: 'stop_all', payload: {}, source: 'manual' }),
      });
      setState({});
      onCommand?.();
    } catch {}
    finally { setLoading(null); }
  };

  const getLabel = (key: string, fallback: string) => zoneNames[key] || fallback;
  const isOn     = (key: string) => !!state[key];

  const activatedPremium = licenses.filter((l) => l.activated);
  const lockedPremium    = licenses.filter((l) => !l.activated);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">Controls</div>
        <button onClick={stopAll} disabled={loading === 'stop_all'}
          className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-100 disabled:opacity-50 transition">
          🛑 Stop All
        </button>
      </div>

      {/* Core relays (always visible) */}
      <div className="grid grid-cols-2 gap-2">
        {CORE_RELAYS.map(({ key, label, icon, type }) => {
          const on = isOn(key);
          const busy = loading === key;
          const displayLabel = getLabel(key, label);
          return (
            <div key={key} className={`rounded-xl border p-3 transition ${
              on ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-base">{icon}</span>
                  <span className="text-xs font-semibold ml-1.5">{displayLabel}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>{on ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => sendCommand(type === 'valve' ? 'valve_on' : 'relay_on', key)}
                  disabled={busy || on}
                  className="flex-1 text-xs py-1 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 transition">
                  {busy && !on ? '…' : 'ON'}
                </button>
                <button onClick={() => sendCommand(type === 'valve' ? 'valve_off' : 'relay_off', key)}
                  disabled={busy || !on}
                  className="flex-1 text-xs py-1 rounded-lg bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 disabled:opacity-40 transition">
                  OFF
                </button>
              </div>
              {type === 'valve' && (
                <div className="flex gap-1 mt-1.5">
                  {[5, 10, 20].map((m) => (
                    <button key={m} onClick={() => sendCommand('water_for', key, m * 60)}
                      disabled={busy}
                      className="flex-1 text-xs py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-40 transition">
                      {m}m
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* relay5 is WiFi indicator — firmware-controlled only, not shown to user */}

      {/* Premium add-on relays (activated) */}
      {activatedPremium.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-purple-600 mb-2">⚡ Extra Zones</p>
          <div className="grid grid-cols-2 gap-2">
            {activatedPremium.map((lic) => {
              const on   = isOn(lic.relay_key);
              const busy = loading === lic.relay_key;
              const displayLabel = getLabel(lic.relay_key, lic.label);
              return (
                <div key={lic.relay_key} className={`rounded-xl border p-3 transition ${
                  on ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">💧 {displayLabel}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      on ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>{on ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => sendCommand('valve_on', lic.relay_key)}
                      disabled={busy || on}
                      className="flex-1 text-xs py-1 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-40 transition">
                      ON
                    </button>
                    <button onClick={() => sendCommand('valve_off', lic.relay_key)}
                      disabled={busy || !on}
                      className="flex-1 text-xs py-1 rounded-lg bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 disabled:opacity-40 transition">
                      OFF
                    </button>
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {[5, 10, 20].map((m) => (
                      <button key={m} onClick={() => sendCommand('water_for', lic.relay_key, m * 60)}
                        disabled={busy}
                        className="flex-1 text-xs py-0.5 rounded bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-40 transition">
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spare outputs — request to activate */}
      {lockedPremium.length > 0 && (
        <LockedOutputs deviceId={deviceId} lockedPremium={lockedPremium} />
      )}
    </div>
  );
}
