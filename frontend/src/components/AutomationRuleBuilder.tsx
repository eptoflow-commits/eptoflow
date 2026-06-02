'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * AutomationRuleBuilder — per-valve automation threshold configuration
 *
 * Each valve supports:
 *   - Manual / Auto mode toggle
 *   - ON condition: moisture < X%, temperature > Y°C, AND/OR logic
 *   - OFF condition: moisture > X%, temperature < Y°C
 *   - Optional schedule window (HH:MM–HH:MM)
 *   - Max run duration safety cap
 */

type Rule = {
  valve_key:       string;
  enabled:         boolean;
  mode:            'manual' | 'auto';
  on_moisture_lt:  number | null;
  on_temp_gt:      number | null;
  on_logic:        'AND' | 'OR';
  off_moisture_gt: number | null;
  off_temp_lt:     number | null;
  off_logic:       'AND' | 'OR';
  schedule_start:  string | null;
  schedule_end:    string | null;
  max_duration_s:  number;
};

const DEFAULT_RULE = (valveKey: string): Rule => ({
  valve_key: valveKey, enabled: true, mode: 'auto',
  on_moisture_lt: null, on_temp_gt: null, on_logic: 'AND',
  off_moisture_gt: null, off_temp_lt: null, off_logic: 'AND',
  schedule_start: null, schedule_end: null,
  max_duration_s: valveKey === 'relay6' ? 600 : 1800,
});

const VALVE_LABELS: Record<string, string> = {
  valve1: '🌿 Daily Watering',      valve2: '🌱 Occasional Watering', valve3: '🌊 Misting',
  relay1: '⚙️ Motor / Light',       relay6: '💊 MediSpray',   relay7: '💧 Extra Zone 1', relay8: '💧 Extra Zone 2',
};

type Props = { deviceId: string; availableValves: string[]; zoneNames?: Record<string, string> };

export default function AutomationRuleBuilder({ deviceId, availableValves, zoneNames = {} }: Props) {
  const [rules, setRules]     = useState<Record<string, Rule>>({});
  const [saving, setSaving]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(availableValves[0] ?? null);
  const [msg, setMsg]         = useState<Record<string, string>>({});

  useEffect(() => {
    api<{ rules: Rule[] }>(`/api/relays/${deviceId}/automation`)
      .then((r) => {
        const map: Record<string, Rule> = {};
        for (const rule of r.rules) map[rule.valve_key] = rule;
        setRules(map);
      })
      .catch(() => {});
  }, [deviceId]);

  const getRule = (key: string): Rule => rules[key] ?? DEFAULT_RULE(key);

  const updateField = (key: string, field: keyof Rule, value: any) => {
    setRules((prev) => ({ ...prev, [key]: { ...getRule(key), [field]: value } }));
  };

  const save = async (key: string) => {
    setSaving(key);
    try {
      const r = getRule(key);
      await api<{ rule: Rule }>(`/api/relays/${deviceId}/automation/${key}`, {
        method: 'PUT',
        body: JSON.stringify(r),
      });
      setMsg((m) => ({ ...m, [key]: '✓ Saved' }));
      setTimeout(() => setMsg((m) => ({ ...m, [key]: '' })), 2500);
    } catch (e: any) {
      setMsg((m) => ({ ...m, [key]: `✗ ${e.message}` }));
    } finally {
      setSaving(null);
    }
  };

  const deleteRule = async (key: string) => {
    await api(`/api/relays/${deviceId}/automation/${key}`, { method: 'DELETE' }).catch(() => {});
    setRules((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  return (
    <div className="card space-y-3">
      <div>
        <div className="font-medium">Automation rules</div>
        <p className="text-xs text-gray-500 mt-0.5">
          Set moisture &amp; temperature thresholds — device waters automatically even when offline.
        </p>
      </div>

      {availableValves.map((key) => {
        const r = getRule(key);
        const isOpen = expanded === key;
        const label = zoneNames[key] || VALVE_LABELS[key] || key;

        return (
          <div key={key} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header / toggle */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
              onClick={() => setExpanded(isOpen ? null : key)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  r.mode === 'auto' && r.enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {r.mode === 'auto' && r.enabled ? 'AUTO' : 'MANUAL'}
                </span>
              </div>
              <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="p-4 space-y-4 text-sm">
                {/* Mode toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 font-medium w-24">Mode</span>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {(['manual', 'auto'] as const).map((m) => (
                      <button key={m} onClick={() => updateField(key, 'mode', m)}
                        className={`px-4 py-1.5 text-xs font-semibold transition ${
                          r.mode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}>
                        {m === 'manual' ? '🖐 Manual' : '🤖 Auto'}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 ml-auto">
                    <input type="checkbox" checked={r.enabled}
                      onChange={(e) => updateField(key, 'enabled', e.target.checked)}
                      className="accent-green-600" />
                    <span className="text-xs text-gray-500">Enabled</span>
                  </label>
                </div>

                {r.mode === 'auto' && (
                  <>
                    {/* ON conditions */}
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 space-y-3">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Turn ON when…</p>
                      <ThresholdRow
                        label="Moisture below"
                        unit="%"
                        min={0} max={100} step={1}
                        value={r.on_moisture_lt}
                        onChange={(v) => updateField(key, 'on_moisture_lt', v)}
                        placeholder="e.g. 30"
                      />
                      <ThresholdRow
                        label="Temperature above"
                        unit="°C"
                        min={0} max={60} step={0.5}
                        value={r.on_temp_gt}
                        onChange={(v) => updateField(key, 'on_temp_gt', v)}
                        placeholder="e.g. 34"
                      />
                      {r.on_moisture_lt !== null && r.on_temp_gt !== null && (
                        <LogicToggle value={r.on_logic}
                          onChange={(v) => updateField(key, 'on_logic', v)} />
                      )}
                    </div>

                    {/* OFF conditions */}
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-3">
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Turn OFF when…</p>
                      <ThresholdRow
                        label="Moisture above"
                        unit="%"
                        min={0} max={100} step={1}
                        value={r.off_moisture_gt}
                        onChange={(v) => updateField(key, 'off_moisture_gt', v)}
                        placeholder="e.g. 55"
                      />
                      <ThresholdRow
                        label="Temperature below"
                        unit="°C"
                        min={0} max={60} step={0.5}
                        value={r.off_temp_lt}
                        onChange={(v) => updateField(key, 'off_temp_lt', v)}
                        placeholder="e.g. 25"
                      />
                      {r.off_moisture_gt !== null && r.off_temp_lt !== null && (
                        <LogicToggle value={r.off_logic}
                          onChange={(v) => updateField(key, 'off_logic', v)} />
                      )}
                    </div>

                    {/* Schedule window */}
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 font-medium">⏰ Run window (optional, UTC)</p>
                      <div className="flex items-center gap-2">
                        <input type="time" value={r.schedule_start ?? ''}
                          onChange={(e) => updateField(key, 'schedule_start', e.target.value || null)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs" />
                        <span className="text-gray-400">→</span>
                        <input type="time" value={r.schedule_end ?? ''}
                          onChange={(e) => updateField(key, 'schedule_end', e.target.value || null)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs" />
                        {(r.schedule_start || r.schedule_end) && (
                          <button onClick={() => {
                            updateField(key, 'schedule_start', null);
                            updateField(key, 'schedule_end', null);
                          }} className="text-xs text-red-400 hover:text-red-600">✕ clear</button>
                        )}
                      </div>
                    </div>

                    {/* Max duration */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-32">Max run time</span>
                      {key === 'relay6' ? (
                        <span className="text-xs text-amber-600 font-semibold">⏱ 10 min max (MediSpray)</span>
                      ) : (
                        <select value={r.max_duration_s}
                          onChange={(e) => updateField(key, 'max_duration_s', parseInt(e.target.value))}
                          className="border border-gray-300 rounded px-2 py-1 text-xs">
                          <option value={300}>5 min</option>
                          <option value={600}>10 min</option>
                          <option value={900}>15 min</option>
                          <option value={1800}>30 min</option>
                          <option value={3600}>1 hour</option>
                          <option value={7200}>2 hours</option>
                        </select>
                      )}
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => save(key)} disabled={saving === key}
                    className="btn btn-primary text-xs py-1.5 disabled:opacity-50">
                    {saving === key ? 'Saving…' : 'Save rule'}
                  </button>
                  <button onClick={() => deleteRule(key)}
                    className="btn text-xs py-1.5 text-red-500 border border-red-200 hover:bg-red-50">
                    Delete rule
                  </button>
                  {msg[key] && <span className={`text-xs ml-2 ${msg[key].startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg[key]}</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ThresholdRow({ label, unit, min, max, step, value, onChange, placeholder }: {
  label: string; unit: string; min: number; max: number; step: number;
  value: number | null; onChange: (v: number | null) => void; placeholder: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-36">{label}</span>
      {value !== null ? (
        <div className="flex items-center gap-2 flex-1">
          <input type="range" min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 accent-blue-600" />
          <span className="text-xs font-mono w-14 text-right">{value}{unit}</span>
          <button onClick={() => onChange(null)} className="text-xs text-gray-400 hover:text-red-400">✕</button>
        </div>
      ) : (
        <button onClick={() => onChange(min + (max - min) * 0.3)}
          className="text-xs text-blue-600 border border-blue-200 px-3 py-0.5 rounded-full hover:bg-blue-50">
          + Set ({placeholder})
        </button>
      )}
    </div>
  );
}

function LogicToggle({ value, onChange }: { value: 'AND' | 'OR'; onChange: (v: 'AND' | 'OR') => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Both conditions:</span>
      {(['AND', 'OR'] as const).map((l) => (
        <button key={l} onClick={() => onChange(l)}
          className={`text-xs px-3 py-0.5 rounded-full border font-semibold transition ${
            value === l ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
          }`}>
          {l === 'AND' ? 'Both (AND)' : 'Either (OR)'}
        </button>
      ))}
    </div>
  );
}
