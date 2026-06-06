'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

/**
 * SensorGraph — live moisture + temperature history graph
 * Visual redesign v2: premium gauge cards + smooth canvas chart
 */

type Reading = { moisture_pct: number | null; temp_c: number | null; recorded_at: string };
type Latest  = Reading & { read_ok: boolean; sensor_addr: number };
type Props   = { deviceId: string };

/* ── Arc gauge helper ──────────────────────────────────────────── */
function ArcGauge({ value, max, color, size = 80 }: { value: number; max: number; color: string; size?: number }) {
  const r    = (size / 2) - 8;
  const circ = Math.PI * r; // half-circle
  const pct  = Math.min(1, Math.max(0, value / max));
  const dash = pct * circ;
  const cx   = size / 2;
  const cy   = size / 2 + 8;

  return (
    <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`} style={{ overflow: 'visible' }}>
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#f1f5f9" strokeWidth="7" strokeLinecap="round"
      />
      {/* Value arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r="4" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}/>
    </svg>
  );
}

export default function SensorGraph({ deviceId }: Props) {
  const [latest,   setLatest]   = useState<Latest | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<'moisture' | 'temp'>('moisture');
  const [pulse,    setPulse]    = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const r = await api<{ latest: Latest | null; sparkline: Reading[] }>(`/api/sensors/${deviceId}`);
      setLatest(r?.latest ?? null);
      setReadings(Array.isArray(r?.sparkline) ? r.sparkline : []);
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch {
      // keep last data on network error
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Premium canvas chart
  useEffect(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas || readings.length < 2) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const W   = canvas.offsetWidth  || 500;
      const H   = 130;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const values = readings
        .map(r => view === 'moisture' ? r.moisture_pct : r.temp_c)
        .filter((v): v is number => typeof v === 'number' && isFinite(v));

      if (values.length < 2) return;

      const minV  = Math.min(...values);
      const maxV  = Math.max(...values);
      const range = maxV - minV || 1;
      const pad   = { top: 16, bottom: 32, left: 14, right: 14 };
      const gW    = W - pad.left - pad.right;
      const gH    = H - pad.top - pad.bottom;

      const toX = (i: number) => pad.left + (i / (values.length - 1)) * gW;
      const toY = (v: number) => pad.top + (1 - (v - minV) / range) * gH;

      // Smooth curve using bezier
      const smooth = (arr: number[], axis: 'x' | 'y', i: number) =>
        axis === 'x' ? toX(i) : toY(arr[i]);

      const isMoist = view === 'moisture';
      const lineColor  = isMoist ? '#0ea5e9' : '#f97316';
      const gradTop    = isMoist ? 'rgba(14,165,233,0.22)' : 'rgba(249,115,22,0.22)';

      // Horizontal grid lines
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth   = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (i / 4) * gH;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Gradient fill under curve
      const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
      grad.addColorStop(0, gradTop);
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(values[0]));
      for (let i = 1; i < values.length; i++) {
        const cpx1 = (toX(i - 1) + toX(i)) / 2;
        const cpy1 = toY(values[i - 1]);
        const cpx2 = (toX(i - 1) + toX(i)) / 2;
        const cpy2 = toY(values[i]);
        ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, toX(i), toY(values[i]));
      }
      ctx.lineTo(toX(values.length - 1), H - pad.bottom);
      ctx.lineTo(toX(0), H - pad.bottom);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Smooth line
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(values[0]));
      for (let i = 1; i < values.length; i++) {
        const cpx1 = (toX(i - 1) + toX(i)) / 2;
        const cpy1 = toY(values[i - 1]);
        const cpx2 = (toX(i - 1) + toX(i)) / 2;
        const cpy2 = toY(values[i]);
        ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, toX(i), toY(values[i]));
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Last-point glow dot
      const lx = toX(values.length - 1);
      const ly = toY(values[values.length - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur  = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Min/max labels
      ctx.fillStyle = '#94a3b8';
      ctx.font      = '10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`${minV.toFixed(1)}`, pad.left, H - 6);
      ctx.textAlign = 'right';
      ctx.fillText(`${maxV.toFixed(1)}`, W - pad.right, H - 6);
      ctx.textAlign = 'center';
      ctx.fillText('24h', W / 2, H - 6);
    } catch (e) {
      console.error('[SensorGraph] draw:', e);
    }
  }, [readings, view]);

  const moisture = latest?.moisture_pct != null ? Number(latest.moisture_pct) : null;
  const temp     = latest?.temp_c       != null ? Number(latest.temp_c)       : null;
  const online   = !!latest?.read_ok && latest !== null;

  const mColor = moisture == null ? '#94a3b8' : moisture < 20 ? '#ef4444' : moisture < 35 ? '#f59e0b' : moisture > 70 ? '#0ea5e9' : '#10b981';
  const tColor = temp     == null ? '#94a3b8' : temp > 40     ? '#ef4444' : temp > 35     ? '#f97316' : '#10b981';
  const mLabel = moisture == null ? 'No data'   : moisture < 20 ? 'Very dry' : moisture < 35 ? 'Dry' : moisture > 70 ? 'Saturated' : 'Optimal';
  const tLabel = temp     == null ? 'No data'   : temp > 40     ? 'Critical' : temp > 35     ? 'Hot'  : 'Normal';

  return (
    <div style={{
      background: '#fff', borderRadius: 22,
      border: '1.5px solid #f1f5f9',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes sensorPulse { 0%{transform:scale(1)} 50%{transform:scale(1.06)} 100%{transform:scale(1)} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(14,165,233,0.2)',
            border: '1px solid rgba(14,165,233,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🌱</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>Soil Sensor</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>RS485 Modbus · Auto-refresh 30s</div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          background: loading ? 'rgba(255,255,255,0.08)' : online ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${loading ? 'rgba(255,255,255,0.12)' : online ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: loading ? '#94a3b8' : online ? '#34d399' : '#ef4444',
            animation: online && !loading ? 'dotPulse 2s infinite' : 'none',
          }}/>
          <span style={{ fontSize: 11, fontWeight: 700, color: loading ? '#94a3b8' : online ? '#34d399' : '#ef4444' }}>
            {loading ? 'Loading…' : online ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Gauge cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#f8fafc' }}>

        {/* Moisture */}
        <div style={{ background: '#fff', padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {loading ? (
            <div className="shimmer" style={{ width: 80, height: 50, borderRadius: 12 }}/>
          ) : (
            <>
              <ArcGauge value={moisture ?? 0} max={100} color={mColor} size={90} />
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>💧 Moisture</div>
              <div style={{
                fontSize: 32, fontWeight: 900, color: mColor,
                letterSpacing: '-0.04em', lineHeight: 1,
                animation: pulse ? 'sensorPulse 0.5s ease' : 'none',
              }}>
                {moisture != null ? `${moisture.toFixed(1)}%` : '—'}
              </div>
              <div style={{
                marginTop: 6, fontSize: 11, fontWeight: 700, color: mColor,
                background: `${mColor}14`, padding: '3px 10px', borderRadius: 20,
              }}>
                {mLabel}
              </div>
            </>
          )}
        </div>

        {/* Temperature */}
        <div style={{ background: '#fff', padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {loading ? (
            <div className="shimmer" style={{ width: 80, height: 50, borderRadius: 12 }}/>
          ) : (
            <>
              <ArcGauge value={temp ?? 0} max={50} color={tColor} size={90} />
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>🌡️ Temperature</div>
              <div style={{
                fontSize: 32, fontWeight: 900, color: tColor,
                letterSpacing: '-0.04em', lineHeight: 1,
                animation: pulse ? 'sensorPulse 0.5s ease' : 'none',
              }}>
                {temp != null ? `${temp.toFixed(1)}°C` : '—'}
              </div>
              <div style={{
                marginTop: 6, fontSize: 11, fontWeight: 700, color: tColor,
                background: `${tColor}14`, padding: '3px 10px', borderRadius: 20,
              }}>
                {tLabel}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      {readings.length > 1 && (
        <div style={{ padding: '14px 16px 16px', background: '#fff', borderTop: '1px solid #f8fafc' }}>
          {/* Toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['moisture', 'temp'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: view === v
                  ? (v === 'moisture' ? '#0ea5e9' : '#f97316')
                  : '#f1f5f9',
                color: view === v ? '#fff' : '#64748b',
                fontSize: 11, fontWeight: 700,
                transition: 'all 0.2s',
                boxShadow: view === v ? `0 3px 10px ${v === 'moisture' ? 'rgba(14,165,233,0.4)' : 'rgba(249,115,22,0.4)'}` : 'none',
              }}>
                {v === 'moisture' ? '💧 Moisture' : '🌡️ Temp'}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', fontWeight: 600, alignSelf: 'center' }}>
              {readings.length} pts
            </span>
          </div>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%', display: 'block',
              borderRadius: 14, background: '#fafbfc',
              border: '1px solid #f1f5f9',
            }}
          />
        </div>
      )}

      {!loading && readings.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', background: '#fff', borderTop: '1px solid #f8fafc' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
            No sensor data yet
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3 }}>
            Ensure RS485 sensor is connected and device is online
          </div>
        </div>
      )}
    </div>
  );
}
