'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * In-app voice button using the browser's Web Speech API (SpeechRecognition).
 * Free, no external API. Premium plan only.
 *
 * The captured transcript is sent to /api/voice/command on the backend,
 * which parses it and enqueues a command for the device.
 */
type Props = { deviceId: string; disabled?: boolean; onCommand?: () => void };

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export default function VoiceButton({ deviceId, disabled, onCommand }: Props) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const recogRef = useRef<any>(null);

  useEffect(() => {
    const SR = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    if (!SR) return;
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = async (e: any) => {
      const t = e.results[0][0].transcript;
      setResult(t);
      setStatus('Sending…');
      try {
        await api('/api/voice/command', {
          method: 'POST',
          body: JSON.stringify({ device_id: deviceId, transcript: t }),
        });
        setStatus(`Queued: “${t}”`);
        onCommand?.();
      } catch (err: any) {
        setStatus(err.message || 'Voice command failed');
      }
    };
    r.onerror = (e: any) => setStatus(`Error: ${e.error}`);
    r.onend = () => setListening(false);
    recogRef.current = r;
  }, [deviceId, onCommand]);

  const toggle = () => {
    const r = recogRef.current;
    if (!r) { setStatus('Voice not supported on this browser'); return; }
    if (listening) { r.stop(); return; }
    setResult(''); setStatus('Listening…');
    setListening(true);
    try { r.start(); } catch { /* already running */ }
  };

  const supported = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
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
      {!supported && (
        <p className="text-xs text-gray-500">Your browser does not support Web Speech API. Try Chrome or Edge.</p>
      )}
      {result && <p className="text-sm"><span className="text-gray-500">Heard:</span> {result}</p>}
      {status && <p className="text-xs text-gray-600 mt-1">{status}</p>}
      <p className="text-xs text-gray-400 mt-2">
        Examples: “turn on valve 1”, “start watering for 2 minutes”, “turn off motor”, “stop”.
      </p>
    </div>
  );
}
