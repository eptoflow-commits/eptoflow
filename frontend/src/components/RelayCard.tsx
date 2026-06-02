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

const CORE_RELAYS = [
  { key: 'valve1', label: 'Zone 1',     icon: '🌿', type: 'valve' },
  { key: 'valve2', label: 'Zone 2',     icon: '🌱', type: 'valve' },
  { key: 'valve3', label: 'Zone 3',     icon: '🌾', type: 'valve' },
  { key: 'relay1', label: 'Motor',      icon: '⚙️', type: 'relay' },
];

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
        <div className="font-medium">Relay control</div>
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
          <p className="text-xs font-semibold text-purple-600 mb-2">⚡ Premium Add-ons</p>
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

      {/* Spare relay outputs — ₹50 each */}
      {lockedPremium.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg,#fdf4ff,#f5f3ff)',
          border: '1.5px solid #e9d5ff',
          borderRadius: 14, padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#6d28d9' }}>
                {lockedPremium.length} Spare Relay Output{lockedPremium.length > 1 ? 's' : ''} Available
              </div>
              <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 1 }}>
                Add extra valve zones to your setup
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lockedPremium.map((lic) => (
              <div key={lic.relay_key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fff', borderRadius: 10, padding: '10px 12px',
                border: '1px solid #ede9fe',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>💧</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{lic.label}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>Smart automation included</div>
                  </div>
                </div>
                <div style={{
                  background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                  color: '#fff', borderRadius: 8, padding: '5px 12px',
                  fontSize: 12, fontWeight: 800,
                }}>₹50</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10, textAlign: 'center' }}>
            Contact Eptoflow to activate — each output includes smart automation
          </div>
        </div>
      )}
    </div>
  );
}
