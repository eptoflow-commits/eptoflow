'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * ZoneNameEditor — lets users rename their device zones and relay.
 *
 * Zones:  valve1, valve2, valve3, relay1
 * Defaults: "Zone 1", "Zone 2", "Zone 3", "Main Motor"
 *
 * After renaming, users can say commands like:
 *   "Water Tomato Bed for 5 minutes"
 *   "Open Rose Garden"
 *   "Turn off Main Motor"
 */

type ZoneMap = Record<string, string>;

const ZONE_KEYS = ['valve1', 'valve2', 'valve3', 'relay1'] as const;
const ZONE_ICONS: Record<string, string> = {
  valve1: '🌿', valve2: '🌱', valve3: '🌾', relay1: '⚙️',
};
const ZONE_TYPES: Record<string, string> = {
  valve1: 'Valve 1', valve2: 'Valve 2', valve3: 'Valve 3', relay1: 'Relay / Motor',
};

type Props = { deviceId: string };

export default function ZoneNameEditor({ deviceId }: Props) {
  const [zones, setZones]     = useState<ZoneMap>({});
  const [draft, setDraft]     = useState<ZoneMap>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ zones: ZoneMap }>(`/api/devices/${deviceId}/zones`)
      .then((r) => {
        setZones(r.zones);
        setDraft(r.zones);
      })
      .catch(() => {
        // Device may not have zones yet — use defaults
        const defaults: ZoneMap = {
          valve1: 'Zone 1', valve2: 'Zone 2', valve3: 'Zone 3', relay1: 'Main Motor',
        };
        setZones(defaults);
        setDraft(defaults);
      })
      .finally(() => setLoading(false));
  }, [deviceId]);

  const isDirty = ZONE_KEYS.some((k) => draft[k] !== zones[k]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await api<{ zones: ZoneMap }>(`/api/devices/${deviceId}/zones`, {
        method: 'PATCH',
        body: JSON.stringify({ zones: draft }),
      });
      setZones(result.zones);
      setDraft(result.zones);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Could not save zone names');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setDraft({ ...zones }); setError(''); };

  if (loading) {
    return (
      <div className="card">
        <div className="font-medium mb-2">Zone names</div>
        <p className="text-xs text-gray-400 animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div>
        <div className="font-medium">Zone &amp; motor names</div>
        <p className="text-xs text-gray-500 mt-0.5">
          Give each zone a name you can speak — e.g. "Tomato Bed" or "Front Lawn".
        </p>
      </div>

      {/* Zone inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ZONE_KEYS.map((key) => (
          <label key={key} className="block">
            <span className="text-xs text-gray-500 font-medium block mb-1">
              {ZONE_ICONS[key]} {ZONE_TYPES[key]}
            </span>
            <input
              type="text"
              maxLength={40}
              value={draft[key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              placeholder={ZONE_TYPES[key]}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         placeholder:text-gray-300"
            />
          </label>
        ))}
      </div>

      {/* Voice hint */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
        <p className="text-xs font-medium text-blue-700">🎤 Voice command examples</p>
        {ZONE_KEYS.filter((k) => k !== 'relay1').map((key) => (
          <p key={key} className="text-xs text-blue-600">
            "Water <strong>{draft[key] || ZONE_TYPES[key]}</strong> for 5 minutes"
          </p>
        ))}
        <p className="text-xs text-blue-600">
          "Turn on <strong>{draft['relay1'] || 'Main Motor'}</strong>"
        </p>
        <p className="text-xs text-blue-600">
          "Stop <strong>{draft['valve1'] || 'Zone 1'}</strong>"
        </p>
      </div>

      {/* Actions */}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="btn btn-primary text-sm py-1.5 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save names'}
        </button>
        {isDirty && (
          <button onClick={reset} className="btn btn-outline text-sm py-1.5">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
