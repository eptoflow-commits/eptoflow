'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Device, Subscription, Plan } from '@/lib/types';
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

/* ─── AQI card — compact single-row strip ───────────────────────────── */
function AqiCard({ weather }: { weather: Weather }) {
  if (weather.aqi === null) return null;
  const a   = aqiLabel(weather.aqi);
  const pct = Math.min(100, (weather.aqi / 300) * 100);
  const gardenTip =
    weather.aqi <= 50  ? 'Great for gardening' :
    weather.aqi <= 100 ? 'Fine to garden today' :
    weather.aqi <= 150 ? 'Rinse plant leaves' :
    'Limit outdoor time';

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        background: '#fff', borderRadius: 18,
        border: `1.5px solid ${a.color}20`,
        boxShadow: `0 2px 12px ${a.color}12`,
        overflow: 'hidden',
      }}>
        {/* Main row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          {/* Emoji badge */}
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: a.bg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20,
          }}>{a.emoji}</div>

          {/* Label + bar */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 800, color: a.color }}>{a.label}</span>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginLeft: 6 }}>Air Quality</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 900, color: a.color, letterSpacing: '-0.03em' }}>
                {Math.round(weather.aqi)}
                <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.6, marginLeft: 2 }}>AQI</span>
              </span>
            </div>
            {/* Thin progress bar */}
            <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99, width: `${pct}%`,
                background: 'linear-gradient(90deg,#22c55e,#f59e0b,#ef4444)',
                transition: 'width 1.2s ease',
              }}/>
            </div>
          </div>
        </div>

        {/* Chips row — PM data + tip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          padding: '0 16px 12px',
        }}>
          {weather.pm25 !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>PM2.5</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#1e293b' }}>{Math.round(weather.pm25)}</span>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>µg/m³</span>
            </div>
          )}
          {weather.pm10 !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>PM10</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#1e293b' }}>{Math.round(weather.pm10)}</span>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>µg/m³</span>
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: a.bg }}>
            <span style={{ fontSize: 11 }}>🌿</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: a.color }}>{gardenTip}</span>
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
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const [s, d] = await Promise.all([
          api<{ subscription: Subscription | null; plan: Plan | null }>('/api/subscriptions/me'),
          api<{ devices: Device[] }>('/api/devices'),
        ]);
        setSub(s.subscription);
        setDevices(d.devices);
      } catch {}
      timer = setTimeout(load, 15000);
    };
    load();
    fetchWeather().then(w => { setWeather(w); setWeatherLoading(false); });
    return () => clearTimeout(timer);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  const planColor = sub?.plan_name === 'premium' ? '#7c3aed' : sub?.plan_name === 'standard' ? '#0284c7' : '#059669';
  const planDark = sub?.plan_name === 'premium' ? '#6d28d9' : sub?.plan_name === 'standard' ? '#0369a1' : '#047857';

  const onlineDevices = devices.filter(d => d.status === 'online').length;

  return (
    <AppShell>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.45;transform:scale(0.75)}}
        @keyframes shimmerBg{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes heroIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dropIn{0%{opacity:0;transform:scale(0.9)}60%{transform:scale(1.02)}100%{opacity:1;transform:scale(1)}}
        .sk{background:linear-gradient(105deg,#e4efe9 35%,#f0f7f3 50%,#e4efe9 65%);background-size:200% 100%;animation:shimmerBg 1.7s ease-in-out infinite;border-radius:16px}
        .device-row{transition:transform 0.15s ease,box-shadow 0.15s ease}
        .device-row:active{transform:scale(0.975)}
      `}</style>

      {/* ══════════════════════════════════════════════════
          HERO — full-bleed dark green, Apple Weather style
      ══════════════════════════════════════════════════ */}
      <div style={{
        margin:'0 -16px 20px',
        background:'linear-gradient(160deg,#060F0A 0%,#0A2218 45%,#0D5C3D 100%)',
        position:'relative', overflow:'hidden',
        animation:'heroIn 0.5s ease both',
      }}>
        {/* Ambient glow blobs */}
        <div style={{ position:'absolute', top:-60, right:-40, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(34,197,94,0.15) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-40, left:-30, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(14,165,233,0.10) 0%,transparent 70%)', pointerEvents:'none' }}/>

        <div style={{ padding:'28px 24px 0', position:'relative' }}>
          {/* Date + status row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', fontWeight:600, letterSpacing:'0.05em' }}>
              {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {onlineDevices > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:'rgba(34,197,94,0.18)', border:'1px solid rgba(34,197,94,0.3)' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', animation:'pulse 2s infinite' }}/>
                  <span style={{ fontSize:11, color:'#22C55E', fontWeight:700 }}>{onlineDevices} online</span>
                </div>
              )}
            </div>
          </div>

          {/* Greeting */}
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:30, fontWeight:900, color:'#fff', letterSpacing:'-0.04em', lineHeight:1.1 }}>
              {greeting},
            </div>
            <div style={{ fontSize:30, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1.1,
              background:'linear-gradient(90deg,#22C55E,#0EA5E9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              {firstName} {greetEmoji}
            </div>
          </div>

          {/* Weather summary row — inside hero */}
          {weatherLoading ? (
            <div style={{ display:'flex', gap:10, marginBottom:20 }}>
              <div className="sk" style={{ width:100, height:36, background:'rgba(255,255,255,0.08)' }}/>
              <div className="sk" style={{ width:80, height:36, background:'rgba(255,255,255,0.08)' }}/>
            </div>
          ) : weather ? (
            <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:20, overflow:'hidden', animation:'dropIn 0.6s 0.1s both' }}>
              {/* Temp pill */}
              <div style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 16px 10px 14px',
                background:'rgba(255,255,255,0.10)',
                borderRadius:'16px 0 0 16px',
                border:'1px solid rgba(255,255,255,0.12)',
                borderRight:'none',
              }}>
                <div style={{ fontSize:32, fontWeight:900, color:'#fff', letterSpacing:'-0.04em', lineHeight:1 }}>{weather.temp}°</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.9)' }}>{wmo(weather.code).emoji} {wmo(weather.code).label}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>📍 {weather.city}</div>
                </div>
              </div>
              {/* Stats pills */}
              <div style={{
                display:'grid', gridTemplateColumns:'1fr 1fr',
                background:'rgba(255,255,255,0.07)',
                border:'1px solid rgba(255,255,255,0.10)',
                borderRadius:'0 16px 16px 0', overflow:'hidden',
              }}>
                {[
                  [`💧`, `${weather.humidity}%`],
                  [`💨`, `${weather.windKph}km/h`],
                  [`🌧️`, `${weather.rainMm.toFixed(1)}mm`],
                  [`☀️`, `UV ${weather.uvIndex}`],
                ].map(([icon, val]) => (
                  <div key={val} style={{ padding:'7px 12px', display:'flex', alignItems:'center', gap:5, borderBottom:'0.5px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize:13 }}>{icon}</span>
                    <span style={{ fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Watering advice strip at bottom of hero */}
        {weather && (
          <div style={{ padding:'10px 24px 20px', position:'relative' }}>
            {(() => {
              const advice = wateringAdvice(weather);
              return (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(255,255,255,0.08)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', borderRadius:14, border:'1px solid rgba(255,255,255,0.10)' }}>
                  <span style={{ fontSize:20 }}>{advice.icon}</span>
                  <span style={{ fontSize:13, color:'rgba(255,255,255,0.85)', fontWeight:600 }}>{advice.msg}</span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Wave bottom edge */}
        <svg viewBox="0 0 400 28" style={{ display:'block', width:'100%', height:28, marginBottom:-1 }} preserveAspectRatio="none">
          <path d="M0 28 L0 14 Q100 0 200 14 Q300 28 400 14 L400 28 Z" fill="var(--fog)"/>
        </svg>
      </div>

      {/* ── AQI Card ── */}
      {!weatherLoading && weather && (
        <div style={{ marginBottom:14, animation:'cardIn 0.4s 0.12s both' }}>
          <AqiCard weather={weather} />
        </div>
      )}

      {/* ── Plan card (condensed) ── */}
      <div style={{ marginBottom:14, animation:'cardIn 0.4s 0.16s both' }}>
        {sub?.isActive ? (
          <div style={{
            background:`linear-gradient(135deg,${planColor},${planDark})`,
            borderRadius:22, padding:'16px 20px', color:'#fff',
            boxShadow:`0 8px 28px ${planColor}50`,
            display:'flex', alignItems:'center', gap:14,
            position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', right:-16, top:-16, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }}/>
            <div style={{ flex:1, position:'relative' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.10em', fontWeight:700, marginBottom:3 }}>Active Plan</div>
              <div style={{ fontSize:20, fontWeight:900, letterSpacing:'-0.03em', textTransform:'capitalize' }}>{sub.plan_name} ✨</div>
              <div style={{ marginTop:10, background:'rgba(255,255,255,0.18)', borderRadius:99, height:4 }}>
                <div style={{ height:'100%', borderRadius:99, background:'rgba(255,255,255,0.9)', width:`${Math.min(100,((sub.daysRemaining??0)/30)*100)}%`, transition:'width 1s ease' }}/>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:5 }}>
                Expires {new Date(sub.end_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
              </div>
            </div>
            <div style={{ textAlign:'right', position:'relative' }}>
              <div style={{ fontSize:44, fontWeight:900, letterSpacing:'-0.05em', lineHeight:1 }}>{sub.daysRemaining}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>days left</div>
            </div>
          </div>
        ) : (
          <div style={{
            borderRadius:20, padding:'15px 18px',
            background:'linear-gradient(135deg,#fffbeb,#fef3c7)',
            border:'1.5px solid #fcd34d',
            display:'flex', alignItems:'center', gap:14,
          }}>
            <span style={{ fontSize:32 }}>⚡</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, color:'#92400e', fontSize:14 }}>No active plan</div>
              <div style={{ fontSize:12, color:'#b45309', marginTop:2 }}>Activate to start automating your garden</div>
            </div>
            <Link href="/subscription" style={{ padding:'9px 16px', borderRadius:12, background:'linear-gradient(135deg,#d97706,#b45309)', color:'#fff', fontWeight:800, fontSize:12, textDecoration:'none', flexShrink:0 }}>Activate →</Link>
          </div>
        )}
      </div>

      {/* ── Stats strip ── */}
      {sub?.isActive && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14, animation:'cardIn 0.4s 0.20s both' }}>
          {[
            { label:'Devices', val:String(devices.length), sub:'total', icon:'📡', color:'var(--forest)' },
            { label:'Online',  val:String(onlineDevices), sub:'right now', icon:'🟢', color:'#0EA5E9' },
            { label:'Plan',    val:sub.plan_name, sub:'active', icon:'✨', color:planColor, cap:true },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', borderRadius:18, padding:'13px 14px', border:'1px solid var(--haze)', boxShadow:'var(--el-1)' }}>
              <div style={{ fontSize:18, marginBottom:5 }}>{s.icon}</div>
              <div style={{ fontSize:19, fontWeight:900, color:s.color, letterSpacing:'-0.03em', textTransform:s.cap?'capitalize':'none', lineHeight:1.1 }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--dust)', fontWeight:600, marginTop:2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Devices ── */}
      <div style={{ marginBottom:14, animation:'cardIn 0.4s 0.24s both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--ink)', letterSpacing:'-0.01em' }}>Your Devices</div>
          <Link href="/devices" style={{ fontSize:12, color:'var(--forest)', fontWeight:700, textDecoration:'none' }}>View all →</Link>
        </div>

        {devices.length === 0 ? (
          <div style={{ borderRadius:20, padding:'36px 24px', textAlign:'center', background:'#fff', border:'1.5px dashed var(--haze)' }}>
            {/* Branded device icon */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
              <div style={{ width:56, height:56, borderRadius:18, background:'var(--fog)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--dust)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/><path d="M8 6h8M8 10h5"/>
                </svg>
              </div>
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--ink)', marginBottom:5 }}>No devices yet</div>
            <div style={{ fontSize:13, color:'var(--dust)' }}>Contact your admin to add a device</div>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {devices.map(d => {
                const online = d.status === 'online';
                return (
                  <Link key={d.id} href={`/device?id=${d.id}`} style={{ textDecoration:'none' }}>
                    <div className="device-row" style={{
                      background:'#fff', borderRadius:18, padding:'14px 16px',
                      border:`1.5px solid ${online ? 'var(--leaf)' : 'var(--haze)'}`,
                      boxShadow: online ? '0 4px 16px rgba(13,92,61,0.10)' : 'var(--el-1)',
                      display:'flex', alignItems:'center', gap:13,
                      transition:'all 0.18s ease',
                    }}>
                      {/* Branded SVG icon — water drop when online, device icon when offline */}
                      <div style={{
                        width:48, height:48, borderRadius:16, flexShrink:0,
                        background: online ? 'linear-gradient(135deg,#0D5C3D,#15803D)' : '#f1f5f9',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        boxShadow: online ? '0 4px 14px rgba(13,92,61,0.35)' : 'none',
                        transition:'all 0.25s ease',
                      }}>
                        {online ? (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                            <path d="M12 2C8.5 2 5.5 5 5.5 9c0 5.25 6.5 13 6.5 13s6.5-7.75 6.5-13C18.5 5 15.5 2 12 2zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
                          </svg>
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--dust)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/><path d="M8 6h8M8 10h5"/>
                          </svg>
                        )}
                      </div>

                      {/* Device info — name + UID only, no zone names */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:800, fontSize:15, color:'var(--ink)', letterSpacing:'-0.02em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {d.device_name}
                        </div>
                        <div style={{ fontSize:11, color:'var(--dust)', fontFamily:'monospace', marginTop:2, letterSpacing:'0.02em' }}>
                          {d.device_uid}
                        </div>
                      </div>

                      {/* Status pill */}
                      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, background: online ? 'var(--sprout)' : '#f3f4f6', flexShrink:0 }}>
                        <div style={{
                          width:7, height:7, borderRadius:'50%',
                          background: online ? '#22C55E' : '#9ca3af',
                          boxShadow: online ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
                          animation: online ? 'pulse 2s infinite' : 'none',
                        }}/>
                        <span style={{ fontSize:11, fontWeight:700, color: online ? 'var(--forest)' : '#9ca3af', textTransform:'capitalize' }}>
                          {d.status}
                        </span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--haze)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Premium: Voice control only — zone naming moved to device settings */}
            {sub?.plan_name === 'premium' && devices.length > 0 && (
              <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
                {devices.filter(d => d.status === 'online').map(d => (
                  <div key={d.id} style={{
                    background:'#fff', borderRadius:16, padding:'12px 16px',
                    border:'1.5px solid #ede9fe', boxShadow:'0 2px 8px rgba(124,58,237,0.07)',
                    display:'flex', alignItems:'center', gap:12,
                  }}>
                    <div style={{ width:34, height:34, borderRadius:11, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#7c3aed' }}>Voice Control</div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>{d.device_name}</div>
                    </div>
                    <VoiceButton deviceId={d.id} disabled={d.status !== 'online'} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ marginBottom:16, animation:'cardIn 0.4s 0.28s both' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {devices[0] && (
            <Link href={`/device?id=${devices[0].id}`} style={{ textDecoration:'none' }}>
              <div style={{
                background:'linear-gradient(135deg,#0D5C3D 0%,#15803D 100%)',
                borderRadius:20, padding:'18px 16px',
                boxShadow:'0 4px 0 #052E1C, 0 8px 24px rgba(13,92,61,0.35)',
                transition:'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 0 #052E1C, 0 14px 32px rgba(13,92,61,0.45)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='0 4px 0 #052E1C, 0 8px 24px rgba(13,92,61,0.35)'; }}
              >
                <div style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C8.5 2 5.5 5 5.5 9c0 5.25 6.5 13 6.5 13s6.5-7.75 6.5-13C18.5 5 15.5 2 12 2zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
                  </svg>
                </div>
                <div style={{ fontWeight:900, fontSize:14, color:'#fff', letterSpacing:'-0.01em' }}>Control Device</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:3 }}>Manage irrigation zones</div>
              </div>
            </Link>
          )}
          <Link href="/schedules" style={{ textDecoration:'none' }}>
            <div style={{
              background:'#fff', borderRadius:20, padding:'18px 16px',
              border:'1.5px solid var(--haze)', boxShadow:'var(--el-1)',
              transition:'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='var(--el-3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='var(--el-1)'; }}
            >
              <div style={{ width:36, height:36, borderRadius:12, background:'var(--fog)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
                </svg>
              </div>
              <div style={{ fontWeight:900, fontSize:14, color:'var(--ink)', letterSpacing:'-0.01em' }}>Schedules</div>
              <div style={{ fontSize:11, color:'var(--dust)', marginTop:3 }}>Automate watering times</div>
            </div>
          </Link>
        </div>
      </div>

      <div style={{ height:8 }}/>
    </AppShell>
  );
}
