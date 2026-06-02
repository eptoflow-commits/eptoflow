'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Device, Subscription, Notification, Plan } from '@/lib/types';
import VoiceButton from '@/components/VoiceButton';
import ZoneNameEditor from '@/components/ZoneNameEditor';

/* ─── Weather helpers ─────────────────────────────────────────────────── */
type Weather = {
  temp: number; feelsLike: number; humidity: number;
  windKph: number; rainMm: number; uvIndex: number;
  code: number; city: string; isDay: boolean;
  aqi: number | null; pm25: number | null; pm10: number | null;
};

function aqiLabel(aqi: number): { label: string; color: string; bg: string; emoji: string } {
  if (aqi <= 50)  return { label:'Good',                    color:'#059669', bg:'#dcfce7', emoji:'😊' };
  if (aqi <= 100) return { label:'Moderate',                color:'#d97706', bg:'#fef3c7', emoji:'😐' };
  if (aqi <= 150) return { label:'Unhealthy for Sensitive', color:'#ea580c', bg:'#ffedd5', emoji:'😷' };
  if (aqi <= 200) return { label:'Unhealthy',               color:'#dc2626', bg:'#fef2f2', emoji:'🤧' };
  if (aqi <= 300) return { label:'Very Unhealthy',          color:'#9333ea', bg:'#f3e8ff', emoji:'🚨' };
  return                 { label:'Hazardous',               color:'#7f1d1d', bg:'#fef2f2', emoji:'☠️' };
}

// PM2.5 µg/m³ → US AQI approximation
function pm25ToAqi(pm: number): number {
  if (pm <= 12)   return Math.round((50/12) * pm);
  if (pm <= 35.4) return Math.round(50 + (50/23.4) * (pm - 12));
  if (pm <= 55.4) return Math.round(100 + (50/19.9) * (pm - 35.4));
  if (pm <= 150.4)return Math.round(150 + (50/94.9) * (pm - 55.4));
  if (pm <= 250.4)return Math.round(200 + (100/99.9) * (pm - 150.4));
  return Math.round(300 + (200/149.9) * (pm - 250.4));
}

// wttr.in weather codes
const WMO: Record<number, { label: string; emoji: string }> = {
  113: { label:'Sunny',             emoji:'☀️'  },
  116: { label:'Partly cloudy',     emoji:'⛅'  },
  119: { label:'Cloudy',            emoji:'☁️'  },
  122: { label:'Overcast',          emoji:'☁️'  },
  143: { label:'Foggy',             emoji:'🌫️'  },
  176: { label:'Patchy rain',       emoji:'🌦️'  },
  185: { label:'Patchy freezing',   emoji:'🌧️'  },
  200: { label:'Thundery outbreaks',emoji:'⛈️'  },
  227: { label:'Blowing snow',      emoji:'❄️'  },
  248: { label:'Fog',               emoji:'🌫️'  },
  260: { label:'Freezing fog',      emoji:'🌫️'  },
  263: { label:'Light drizzle',     emoji:'🌦️'  },
  266: { label:'Drizzle',           emoji:'🌧️'  },
  281: { label:'Freezing drizzle',  emoji:'🌧️'  },
  293: { label:'Light rain',        emoji:'🌧️'  },
  296: { label:'Light rain',        emoji:'🌧️'  },
  299: { label:'Moderate rain',     emoji:'🌧️'  },
  302: { label:'Heavy rain',        emoji:'🌧️'  },
  305: { label:'Heavy rain',        emoji:'🌧️'  },
  308: { label:'Very heavy rain',   emoji:'🌧️'  },
  353: { label:'Light showers',     emoji:'🌦️'  },
  356: { label:'Heavy showers',     emoji:'⛈️'  },
  389: { label:'Thunderstorm',      emoji:'⛈️'  },
  392: { label:'Thundery snow',     emoji:'⛈️'  },
  395: { label:'Heavy snow',        emoji:'❄️'  },
};
const wmo = (code: number) => WMO[code] ?? { label: 'Clear', emoji: '🌤️' };

function wateringAdvice(w: Weather) {
  if (w.rainMm > 5)  return { msg: 'Skip watering — rain expected today', color: '#0284c7', bg: '#e0f2fe', icon: '🌧️' };
  if (w.rainMm > 1)  return { msg: 'Light rain expected — half your usual watering', color: '#0891b2', bg: '#e0f2fe', icon: '🌦️' };
  if (w.humidity > 80) return { msg: 'High humidity — soil may still be moist', color: '#0284c7', bg: '#e0f2fe', icon: '💧' };
  if (w.temp > 36)   return { msg: 'Very hot — water early morning or evening', color: '#dc2626', bg: '#fef2f2', icon: '🔥' };
  if (w.temp > 30)   return { msg: 'Warm day — good time to water plants', color: '#d97706', bg: '#fffbeb', icon: '🌡️' };
  if (w.uvIndex > 7) return { msg: 'High UV — water before 8am or after 6pm', color: '#d97706', bg: '#fffbeb', icon: '☀️' };
  return { msg: 'Good day to water your garden!', color: '#059669', bg: '#ecfdf5', icon: '🌿' };
}

/**
 * Try to get GPS coords from the browser.
 * Returns null silently if the user denies or the API is unavailable.
 */
async function getBrowserGps(): Promise<{ lat: number; lon: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      ()  => resolve(null),
      { timeout: 5000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

async function fetchWeather(): Promise<Weather | null> {
  try {
    // Prefer GPS coordinates so weather matches the actual device location.
    // Fall back to wttr.in IP-based auto-detection if GPS is unavailable.
    const gps = await getBrowserGps();
    const url = gps
      ? `https://wttr.in/${gps.lat},${gps.lon}?format=j1`
      : 'https://wttr.in/?format=j1';

    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j.current_condition?.[0];
    const area = j.nearest_area?.[0];
    if (!c) return null;

    const city = area?.areaName?.[0]?.value
              || area?.region?.[0]?.value
              || 'Your location';

    const code = parseInt(c.weatherCode ?? '113');
    const rainMm = parseFloat(j.weather?.[0]?.hourly?.reduce(
      (sum: number, h: any) => sum + parseFloat(h.precipMM ?? '0'), 0
    ) ?? '0');

    const cloudCover = parseInt(c.cloudcover ?? '0');
    const uvEstimate = Math.max(0, Math.round((10 - cloudCover / 10) * 0.9));
    const isDay = new Date().getHours() >= 6 && new Date().getHours() < 19;

    // Use GPS coords for AQI if available; otherwise fall back to wttr.in area coords
    const lat = gps?.lat ?? parseFloat(area?.latitude ?? '0');
    const lon = gps?.lon ?? parseFloat(area?.longitude ?? '0');

    // Fetch AQI from Open-Meteo Air Quality (free, no key)
    let aqi: number | null = null;
    let pm25: number | null = null;
    let pm10: number | null = null;
    if (lat !== 0 || lon !== 0) {
      try {
        const aqr = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,us_aqi&timezone=auto`
        );
        if (aqr.ok) {
          const aqj = await aqr.json();
          pm25 = aqj.current?.pm2_5 ?? null;
          pm10 = aqj.current?.pm10 ?? null;
          aqi  = aqj.current?.us_aqi ?? (pm25 !== null ? pm25ToAqi(pm25) : null);
        }
      } catch {}
    }

    return {
      temp: parseInt(c.temp_C ?? '25'),
      feelsLike: parseInt(c.FeelsLikeC ?? '25'),
      humidity: parseInt(c.humidity ?? '60'),
      windKph: parseInt(c.windspeedKmph ?? '0'),
      rainMm: isNaN(rainMm) ? 0 : Math.round(rainMm * 10) / 10,
      uvIndex: uvEstimate,
      code, city, isDay, aqi, pm25, pm10,
    };
  } catch { return null; }
}

/* ─── Watering advice strip ──────────────────────────────────────────── */
function WateringAdviceStrip({ weather }: { weather: Weather }) {
  const advice = wateringAdvice(weather);
  return (
    <div style={{
      margin: '0 12px 12px',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.18)',
      backdropFilter: 'blur(4px)',
      padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{advice.icon}</span>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{advice.msg}</div>
    </div>
  );
}

/* ─── AQI card ───────────────────────────────────────────────────────── */
function AqiCard({ weather }: { weather: Weather }) {
  if (weather.aqi === null) return null;
  const a = aqiLabel(weather.aqi);
  const pct = Math.min(100, (weather.aqi / 300) * 100);
  return (
    <div className="fade-up" style={{ marginBottom: 16, animationDelay: '0.08s' }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '16px 18px',
        border: `2px solid ${a.color}25`,
        boxShadow: `0 4px 20px ${a.color}15`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>{a.emoji}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Air Quality Index</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: a.color, letterSpacing: '-0.02em' }}>{a.label}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', padding: '8px 14px', borderRadius: 12, background: a.bg }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: a.color, lineHeight: 1, letterSpacing: '-0.04em' }}>{Math.round(weather.aqi)}</div>
            <div style={{ fontSize: 10, color: a.color, fontWeight: 700, opacity: 0.7 }}>US AQI</div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, width: `${pct}%`,
              background: 'linear-gradient(90deg,#059669,#d97706,#dc2626)',
              transition: 'width 1s ease',
            }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {['Good', 'Moderate', 'Unhealthy', 'Hazardous'].map(l => (
              <span key={l} style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>{l}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {weather.pm25 !== null && (
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', letterSpacing: '-0.02em' }}>
                {Math.round(weather.pm25)} <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>µg/m³</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>PM2.5 — Fine particles</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Affects lungs & plants</div>
            </div>
          )}
          {weather.pm10 !== null && (
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', letterSpacing: '-0.02em' }}>
                {Math.round(weather.pm10)} <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>µg/m³</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>PM10 — Dust particles</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Settles on leaves</div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 12, background: a.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🌿</span>
          <div style={{ fontSize: 12, color: a.color, fontWeight: 600 }}>
            {weather.aqi <= 50   && 'Great air — perfect day to tend your garden'}
            {weather.aqi > 50   && weather.aqi <= 100 && 'Acceptable air — gardening is fine today'}
            {weather.aqi > 100  && weather.aqi <= 150 && 'Sensitive plants may be affected — rinse leaves'}
            {weather.aqi > 150  && weather.aqi <= 200 && 'Poor air — wipe plant leaves, limit outdoor time'}
            {weather.aqi > 200  && 'Very poor air — keep plants indoors if possible'}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard ───────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const [sub, setSub]       = useState<Subscription | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [weather, setWeather] = useState<Weather | null | 'loading'>('loading');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let timer: any;
    const load = async () => {
      try {
        const [s, d, n] = await Promise.all([
          api<{ subscription: Subscription | null; plan: Plan | null }>('/api/subscriptions/me'),
          api<{ devices: Device[] }>('/api/devices'),
          api<{ notifications: Notification[] }>('/api/notifications'),
        ]);
        setSub(s.subscription);
        setDevices(d.devices);
        setNotifs(n.notifications.slice(0, 3));
      } catch {}
      timer = setTimeout(load, 15000);
    };
    load();
    fetchWeather().then(w => setWeather(w));
    return () => clearTimeout(timer);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  const planColor = sub?.plan_name === 'premium' ? '#7c3aed'
                  : sub?.plan_name === 'standard' ? '#0284c7' : '#059669';
  const planDark  = sub?.plan_name === 'premium' ? '#6d28d9'
                  : sub?.plan_name === 'standard' ? '#0369a1' : '#047857';

  return (
    <AppShell>
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes dropIn   { 0%{opacity:0;transform:scale(0.88) translateY(-8px)} 60%{transform:scale(1.02)} 100%{opacity:1;transform:scale(1)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        .fade-up { animation: fadeUp 0.45s ease both; }
        .drop-in { animation: dropIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
        .shimmer-bg {
          background: linear-gradient(105deg,#e2e8f0 40%,#f8fafc 50%,#e2e8f0 60%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        .device-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(5,150,105,0.15)!important; }
        .notif-card { transition:all 0.2s; }
        .notif-card:hover { transform:translateX(3px); }
      `}</style>

      {/* ── Greeting ── */}
      <div className="fade-up" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:'#0f172a', letterSpacing:'-0.03em', lineHeight:1.2 }}>
              {greetEmoji} {greeting}, {firstName}!
            </div>
            <div style={{ fontSize:13, color:'#94a3b8', marginTop:3, fontWeight:500 }}>
              {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
            </div>
          </div>
          <div style={{
            width:48, height:48, borderRadius:'50%',
            background:`linear-gradient(135deg,${planColor},${planDark})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:22, boxShadow:`0 4px 16px ${planColor}50`,
          }}>🪴</div>
        </div>
      </div>

      {/* ── Weather Card ── */}
      <div className="fade-up" style={{ marginBottom:16, animationDelay:'0.05s' }}>
        {weather === 'loading' ? (
          <div style={{ borderRadius:20, padding:'18px 20px', background:'#f1f5f9', height:100 }} className="shimmer-bg"/>
        ) : weather === null ? (
          <div style={{
            borderRadius:20, padding:'14px 18px',
            background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',
            border:'1.5px solid #bbf7d0', display:'flex', alignItems:'center', gap:12,
          }}>
            <span style={{ fontSize:28 }}>🌿</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:'#166534', fontWeight:700 }}>Weather unavailable</div>
              <div style={{ fontSize:11, color:'#15803d', marginTop:2 }}>Check your internet connection</div>
            </div>
            <button onClick={() => { setWeather('loading'); fetchWeather().then(w => setWeather(w)); }}
              style={{ padding:'8px 14px', borderRadius:10, border:'none', background:'#059669', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Retry
            </button>
          </div>
        ) : (
          <div className="drop-in" style={{
            borderRadius:22, overflow:'hidden',
            background: weather.isDay
              ? 'linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%)'
              : 'linear-gradient(135deg,#1e3a5f 0%,#312e81 100%)',
            boxShadow:'0 8px 32px rgba(14,165,233,0.3)',
          }}>
            {/* Top row */}
            <div style={{ padding:'18px 20px 10px', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', fontWeight:600, marginBottom:2 }}>
                  📍 {weather.city}
                </div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                  <div style={{ fontSize:52, fontWeight:900, color:'#fff', letterSpacing:'-0.04em', lineHeight:1 }}>
                    {weather.temp}°
                  </div>
                  <div style={{ marginBottom:6 }}>
                    <div style={{ fontSize:15, color:'rgba(255,255,255,0.9)', fontWeight:700 }}>
                      {wmo(weather.code).emoji} {wmo(weather.code).label}
                    </div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)' }}>
                      Feels like {weather.feelsLike}°
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ textAlign:'right', marginTop:4 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Today</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                  {[
                    ['💧', `${weather.humidity}% humidity`],
                    ['💨', `${weather.windKph} km/h`],
                    ['🌧️', `${weather.rainMm.toFixed(1)}mm rain`],
                    ['☀️', `UV ${weather.uvIndex}`],
                  ].map(([icon, val]) => (
                    <div key={val as string} style={{ fontSize:12, color:'rgba(255,255,255,0.8)', display:'flex', gap:5, alignItems:'center' }}>
                      <span>{icon}</span> {val}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Watering advice strip */}
            <WateringAdviceStrip weather={weather} />
          </div>
        )}
      </div>

      {/* ── Air Quality Card ── */}
      {weather && weather !== 'loading' && (
        <AqiCard weather={weather} />
      )}

      {/* ── Subscription card ── */}
      <div className="fade-up" style={{ marginBottom:16, animationDelay:'0.1s' }}>
        {sub?.isActive ? (
          <div style={{
            borderRadius:20,
            background:`linear-gradient(135deg,${planColor} 0%,${planDark} 100%)`,
            padding:'16px 20px', color:'#fff',
            boxShadow:`0 8px 28px ${planColor}55`,
            position:'relative', overflow:'hidden',
          }}>
            {/* Decorative circles */}
            <div style={{ position:'absolute', right:-20, top:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }}/>
            <div style={{ position:'absolute', right:30, bottom:-30, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>
                  Active Plan
                </div>
                <div style={{ fontSize:24, fontWeight:900, letterSpacing:'-0.03em', marginTop:2, textTransform:'capitalize' }}>
                  {sub.plan_name} ✨
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:38, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 }}>
                  {sub.daysRemaining}
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>days remaining</div>
              </div>
            </div>
            <div style={{ marginTop:12, background:'rgba(255,255,255,0.2)', borderRadius:99, height:6 }}>
              <div style={{
                height:'100%', borderRadius:99,
                background:'rgba(255,255,255,0.9)',
                width:`${Math.min(100, ((sub.daysRemaining ?? 0) / 30) * 100)}%`,
                transition:'width 1s ease',
                boxShadow:'0 0 8px rgba(255,255,255,0.6)',
              }}/>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:6 }}>
              Expires {new Date(sub.end_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
            </div>
          </div>
        ) : (
          <div style={{
            borderRadius:20, padding:'16px 18px',
            background:'linear-gradient(135deg,#fffbeb,#fef3c7)',
            border:'2px solid #fcd34d',
            boxShadow:'0 4px 16px rgba(251,191,36,0.2)',
            display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={{ fontSize:36 }}>⚡</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, color:'#92400e', fontSize:15 }}>No active plan</div>
              <div style={{ fontSize:12, color:'#b45309', marginTop:2 }}>Activate a plan to start automating your garden</div>
            </div>
            <Link href="/subscription" style={{
              padding:'10px 16px', borderRadius:12, border:'none',
              background:'linear-gradient(135deg,#d97706,#b45309)',
              color:'#fff', fontWeight:800, fontSize:12, textDecoration:'none',
              boxShadow:'0 4px 12px rgba(217,119,6,0.4)', flexShrink:0,
            }}>Activate →</Link>
          </div>
        )}
      </div>

      {/* ── Quick stats row ── */}
      {sub?.isActive && (
        <div className="fade-up" style={{ marginBottom:16, animationDelay:'0.15s', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          {[
            { icon:'📡', label:'Devices', val: devices.length, sub: devices.filter(d=>d.status==='online').length + ' online', color:'#059669' },
            { icon:'🔔', label:'Alerts', val: notifs.length, sub: 'recent', color:'#7c3aed' },
            { icon:'💧', label:'Plan', val: sub.plan_name, sub: 'active', color: planColor, capitalize: true },
          ].map(s => (
            <div key={s.label} style={{
              background:'#fff', borderRadius:16, padding:'12px 14px',
              border:'1.5px solid #f1f5f9',
              boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:18, fontWeight:900, color:s.color, letterSpacing:'-0.02em', textTransform: s.capitalize ? 'capitalize' : 'none' }}>
                {s.val}
              </div>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Devices ── */}
      <div className="fade-up" style={{ marginBottom:16, animationDelay:'0.2s' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ fontWeight:800, color:'#1f2937', fontSize:15 }}>📡 Your Devices</div>
          <Link href="/devices" style={{ fontSize:12, color:planColor, fontWeight:700, textDecoration:'none' }}>View all →</Link>
        </div>
        {devices.length === 0 ? (
          <div style={{
            borderRadius:18, padding:'28px 20px', textAlign:'center',
            background:'linear-gradient(135deg,#f8fafc,#f1f5f9)',
            border:'2px dashed #e2e8f0',
          }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📡</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#374151', marginBottom:4 }}>No devices yet</div>
            <div style={{ fontSize:12, color:'#9ca3af' }}>Contact your admin to add a device</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {devices.map(d => (
              <Link key={d.id} href={`/device?id=${d.id}`} style={{ textDecoration:'none' }}>
                <div className="device-card" style={{
                  background:'#fff', borderRadius:16, padding:'12px 16px',
                  border:`1.5px solid ${d.status==='online' ? '#bbf7d0' : '#e5e7eb'}`,
                  boxShadow:`0 2px 8px ${d.status==='online' ? 'rgba(5,150,105,0.08)' : 'rgba(0,0,0,0.04)'}`,
                  display:'flex', alignItems:'center', gap:12,
                  transition:'all 0.2s',
                }}>
                  <div style={{
                    width:44, height:44, borderRadius:14, flexShrink:0,
                    background: d.status==='online'
                      ? `linear-gradient(135deg,${planColor},${planDark})`
                      : '#f3f4f6',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:20, boxShadow: d.status==='online' ? `0 4px 12px ${planColor}40` : 'none',
                  }}>
                    {d.status==='online' ? '💧' : '💤'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, color:'#1f2937', fontSize:14, marginBottom:2 }}>{d.device_name}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', fontWeight:500 }}>{d.device_uid}</div>
                  </div>
                  <div style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'5px 10px', borderRadius:20,
                    background: d.status==='online' ? '#dcfce7' : '#f3f4f6',
                  }}>
                    <div style={{
                      width:7, height:7, borderRadius:'50%',
                      background: d.status==='online' ? '#059669' : '#9ca3af',
                      boxShadow: d.status==='online' ? '0 0 0 3px rgba(5,150,105,0.2)' : 'none',
                      animation: d.status==='online' ? 'pulse 2s infinite' : 'none',
                    }}/>
                    <span style={{ fontSize:11, fontWeight:700, color: d.status==='online' ? '#059669' : '#9ca3af' }}>
                      {d.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Premium: Zone naming + Voice control ── */}
          {sub?.plan_name === 'premium' && devices.length > 0 && (
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:12 }}>
              {devices.map(d => (
                <div key={d.id} style={{
                  background:'#fff', borderRadius:16, padding:16,
                  border:'1.5px solid #ede9fe',
                  boxShadow:'0 2px 8px rgba(124,58,237,0.06)',
                }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#7c3aed', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                    <span>⚡</span>
                    <span>{d.device_name} — Voice &amp; Zone Control</span>
                    <span style={{ marginLeft:'auto', fontSize:10, background:'#ede9fe', color:'#7c3aed', padding:'2px 7px', borderRadius:20, fontWeight:600 }}>PREMIUM</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <ZoneNameEditor deviceId={d.id} />
                    <VoiceButton deviceId={d.id} disabled={d.status !== 'online'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        )}
      </div>

      {/* ── Recent alerts ── */}
      {notifs.length > 0 && (
        <div className="fade-up" style={{ animationDelay:'0.25s' }}>
          <div style={{ fontWeight:800, color:'#1f2937', fontSize:15, marginBottom:10 }}>🔔 Recent Alerts</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {notifs.map((n, i) => (
              <div key={n.id} className="notif-card" style={{
                background:'#fff', borderRadius:14, padding:'12px 14px',
                border:'1.5px solid #f1f5f9',
                boxShadow:'0 2px 6px rgba(0,0,0,0.04)',
                borderLeft:`4px solid ${planColor}`,
                animationDelay:`${0.3 + i * 0.05}s`,
              }}>
                <div style={{ display:'flex', gap:10 }}>
                  <span style={{ fontSize:18 }}>🔔</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#1f2937', marginBottom:2 }}>{n.title}</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>{n.message}</div>
                    <div style={{ fontSize:10, color:'#9ca3af' }}>{new Date(n.created_at).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ height:16 }}/>
    </AppShell>
  );
}
