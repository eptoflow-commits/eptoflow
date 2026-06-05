'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

/**
 * SensorGraph — live moisture + temperature history graph
 *
 * Uses Canvas API (no external chart lib needed) for a lightweight,
 * responsive sparkline-style graph. Shows 24h history with auto-refresh.
 */

type Reading = { moisture_pct: number | null; temp_c: number | null; recorded_at: string };
type Latest  = Reading & { read_ok: boolean; sensor_addr: number };

type Props = { deviceId: string };

export default function SensorGraph({ deviceId }: Props) {
  const [latest,   setLatest]   = useState<Latest | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<'moisture' | 'temp'>('moisture');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const r = await api<{ latest: Latest | null; sparkline: Reading[] }>(
        `/api/sensors/${deviceId}`
      );
      setLatest(r?.latest ?? null);
      setReadings(Array.isArray(r?.sparkline) ? r.sparkline : []);
    } catch {
      // network/API error — keep showing last data
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(iv);
  }, [fetchData]);

  // Draw canvas graph whenever data or view changes
  useEffect(() => {
    try {
    const canvas = canvasRef.current;
    if (!canvas || readings.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const values = readings.map((r) =>
      view === 'moisture' ? r.moisture_pct : r.temp_c
    ).filter((v): v is number => typeof v === 'number' && isFinite(v));

    if (values.length < 2) return;

    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV || 1;

    const pad = { top: 12, bottom: 24, left: 10, right: 10 };
    const gW  = W - pad.left - pad.right;
    const gH  = H - pad.top  - pad.bottom;

    const toX = (i: number) => pad.left + (i / (values.length - 1)) * gW;
    const toY = (v: number) => pad.top + (1 - (v - minV) / range) * gH;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, view === 'moisture' ? 'rgba(37,99,235,0.25)' : 'rgba(220,38,38,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) ctx.lineTo(toX(i), toY(values[i]));
    ctx.lineTo(toX(values.length - 1), H - pad.bottom);
    ctx.lineTo(toX(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) ctx.lineTo(toX(i), toY(values[i]));
    ctx.strokeStyle = view === 'moisture' ? '#2563eb' : '#dc2626';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Min / max labels
    ctx.fillStyle   = '#6b7280';
    ctx.font        = '10px system-ui';
    ctx.textAlign   = 'left';
    ctx.fillText(`${minV.toFixed(1)}`, 2, H - pad.bottom + 12);
    ctx.textAlign   = 'right';
    ctx.fillText(`${maxV.toFixed(1)}`, W - 2, pad.top + 10);
    } catch (e) {
      console.error('[SensorGraph] canvas draw error:', e);
    }
  }, [readings, view]);

  const moisture = latest?.moisture_pct != null ? Number(latest.moisture_pct) : null;
  const temp     = latest?.temp_c      != null ? Number(latest.temp_c)       : null;
  const online   = !!latest?.read_ok && latest !== null;

  const moistureColor = (v: number) =>
    v < 20 ? '#dc2626' : v < 35 ? '#d97706' : v > 70 ? '#0284c7' : '#059669';
  const tempColor = (v: number) =>
    v > 40 ? '#dc2626' : v > 35 ? '#d97706' : '#059669';

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Soil sensor</div>
          <p className="text-xs text-gray-500">RS485 Modbus · Auto-refresh 30s</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${
          loading ? 'bg-gray-100 text-gray-400' :
          online  ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}/>
          {loading ? 'Loading…' : online ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Current readings */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 border" style={{ borderColor: moisture != null ? moistureColor(moisture) + '40' : '#e5e7eb', background: moisture != null ? moistureColor(moisture) + '08' : '#f9fafb' }}>
            <p className="text-xs text-gray-500 mb-1">💧 Soil Moisture</p>
            <p className="text-2xl font-black" style={{ color: moisture != null ? moistureColor(moisture) : '#9ca3af' }}>
              {moisture != null ? `${moisture.toFixed(1)}%` : '—'}
            </p>
            {moisture != null && (
              <p className="text-xs mt-1" style={{ color: moistureColor(moisture) }}>
                {moisture < 20 ? 'Very dry — water now!' : moisture < 35 ? 'Dry — consider watering' : moisture > 70 ? 'Saturated' : 'Optimal'}
              </p>
            )}
          </div>
          <div className="rounded-xl p-3 border" style={{ borderColor: temp != null ? tempColor(temp) + '40' : '#e5e7eb', background: temp != null ? tempColor(temp) + '08' : '#f9fafb' }}>
            <p className="text-xs text-gray-500 mb-1">🌡️ Temperature</p>
            <p className="text-2xl font-black" style={{ color: temp != null ? tempColor(temp) : '#9ca3af' }}>
              {temp != null ? `${temp.toFixed(1)}°C` : '—'}
            </p>
            {temp != null && (
              <p className="text-xs mt-1" style={{ color: tempColor(temp) }}>
                {temp > 40 ? 'Too hot — water immediately' : temp > 35 ? 'Hot — water in evening' : 'Normal range'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Graph view selector */}
      {readings.length > 1 && (
        <>
          <div className="flex gap-2">
            {(['moisture', 'temp'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition ${
                  view === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                {v === 'moisture' ? '💧 Moisture' : '🌡️ Temperature'}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400">{readings.length} readings · 24h</span>
          </div>
          <canvas ref={canvasRef} width={500} height={120}
            className="w-full rounded-lg border border-gray-100"
            style={{ background: '#fafafa' }} />
        </>
      )}

      {!loading && readings.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          No sensor data yet — make sure the RS485 sensor is connected and device is online.
        </p>
      )}
    </div>
  );
}
