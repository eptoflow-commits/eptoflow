'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * In-app voice button using the browser's Web Speech API (SpeechRecognition).
 * Free, no external API. Premium plan only.
 *
 * Features:
 *  - Multi-language recognition: English, Hindi, Tamil, Telugu, Kannada
 *  - Optional GPS geolocation: attaches lat/lon to the voice command so the
 *    backend can provide location-specific responses (weather, AQI).
 *  - The captured transcript is sent to /api/voice/command on the backend,
 *    which parses it and enqueues a command for the device.
 */

type Props = {
  deviceId: string;
  disabled?: boolean;
  onCommand?: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
] as const;

type LangCode = (typeof LANGUAGES)[number]['code'];

/** Try to get the browser's GPS position (best-effort, non-blocking). */
function getGpsPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),        // user denied or not available → fall back
      { timeout: 4000, maximumAge: 5 * 60 * 1000 }, // cache for 5 min
    );
  });
}

export default function VoiceButton({ deviceId, disabled, onCommand }: Props) {
  const [listening, setListening]   = useState(false);
  const [status, setStatus]         = useState<string>('');
  const [result, setResult]         = useState<string>('');
  const [lang, setLang]             = useState<LangCode>('en-US');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const recogRef = useRef<any>(null);

  // Re-create the recogniser whenever the language changes
  useEffect(() => {
    const SR = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    if (!SR) return;

    const r = new SR();
    r.lang            = lang;
    r.interimResults  = false;
    r.maxAlternatives = 1;

    r.onresult = async (e: any) => {
      const transcript = e.results[0][0].transcript as string;
      setResult(transcript);
      setStatus('Sending…');

      // Attach GPS coordinates if user opted in
      let location: { lat: number; lon: number } | null = null;
      if (gpsEnabled) {
        location = await getGpsPosition();
      }

      try {
        await api('/api/voice/command', {
          method: 'POST',
          body: JSON.stringify({
            device_id:  deviceId,
            transcript,
            ...(location ? { lat: location.lat, lon: location.lon } : {}),
          }),
        });
        setStatus(`✓ Queued: "${transcript}"`);
        onCommand?.();
      } catch (err: any) {
        setStatus(`✗ ${err.message || 'Voice command failed'}`);
      }
    };

    r.onerror = (e: any) => {
      setStatus(`Error: ${e.error}`);
      setListening(false);
    };
    r.onend   = () => setListening(false);

    recogRef.current = r;
  }, [lang, gpsEnabled, deviceId, onCommand]);

  const toggle = () => {
    const r = recogRef.current;
    if (!r) { setStatus('Voice not supported on this browser (try Chrome or Edge)'); return; }
    if (listening) { r.stop(); return; }
    setResult('');
    setStatus('Listening…');
    setListening(true);
    try { r.start(); } catch { /* already running */ }
  };

  const supported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <div className="card space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Voice control</div>
          <div className="text-xs text-gray-500">Premium · Browser Web Speech API</div>
        </div>
        <button
          onClick={toggle}
          disabled={disabled || !supported}
          className={`btn ${listening ? 'btn-danger' : 'btn-primary'} disabled:opacity-50`}
        >
          {listening ? '■ Stop' : '🎤 Speak'}
        </button>
      </div>

      {/* Language + GPS options */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Language selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap" htmlFor="voice-lang">
            Language:
          </label>
          <select
            id="voice-lang"
            value={lang}
            onChange={(e) => { setLang(e.target.value as LangCode); setStatus(''); }}
            disabled={listening}
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white disabled:opacity-50"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* GPS toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={gpsEnabled}
            onChange={(e) => setGpsEnabled(e.target.checked)}
            className="accent-green-600"
          />
          <span className="text-xs text-gray-500">📍 GPS weather</span>
        </label>
      </div>

      {!supported && (
        <p className="text-xs text-amber-600">
          Your browser does not support Web Speech API. Please use Chrome or Edge.
        </p>
      )}

      {result && (
        <p className="text-sm">
          <span className="text-gray-500">Heard:</span> <span className="font-medium">{result}</span>
        </p>
      )}
      {status && <p className="text-xs text-gray-600">{status}</p>}

      <p className="text-xs text-gray-400">
        Examples: "turn on valve 1" · "water zone 2 for 5 minutes" · "stop" · "mausam kaisa hai"
      </p>
    </div>
  );
}
