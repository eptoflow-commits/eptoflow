import { Hono } from 'hono';
import { z } from 'zod';
import type { AppCtx } from '../lib/middleware';
import { authUser, loadSubscription, requirePlan } from '../lib/middleware';
import { Err } from '../lib/errors';
import { newId } from '../lib/ids';
import { parseVoice } from '../services/voice';
import { enqueue } from '../services/command';

const app = new Hono<AppCtx>();
app.use('*', authUser, loadSubscription({ requireActive: true }), requirePlan('premium'));

const schema = z.object({
  device_id:  z.string().min(1),
  transcript: z.string().min(1).max(400),
  // Optional GPS coords from VoiceButton (used for location-aware responses)
  lat: z.number().optional(),
  lon: z.number().optional(),
});

/** Build a pre-processed transcript where custom zone names → canonical keys.
 *  e.g. "water the Tomato Bed for 5 minutes" → "water the valve1 for 5 minutes"
 *  Matching is case-insensitive and longest-match first.
 */
async function resolveZoneNames(
  env: any,
  deviceId: string,
  transcript: string,
): Promise<string> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT zone_key, zone_name FROM device_zones WHERE device_id=?1`
    ).bind(deviceId).all<any>();
    if (!results.length) return transcript;

    // Sort longest name first so "Main Garden" beats "Garden"
    const sorted = [...results].sort(
      (a: any, b: any) => b.zone_name.length - a.zone_name.length
    );
    let t = transcript;
    for (const { zone_key, zone_name } of sorted as any[]) {
      const re = new RegExp(zone_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      t = t.replace(re, zone_key);
    }
    return t;
  } catch {
    return transcript; // table may not exist yet — fall back to original
  }
}

app.post('/command', async (c) => {
  const u = c.get('user')!;
  const { device_id, transcript, lat, lon } = schema.parse(await c.req.json());

  const device = await c.env.DB.prepare(
    `SELECT id, plan_bound, enabled FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(device_id, u.id).first<any>();
  if (!device) throw Err.notFound('Device');
  if (!device.enabled) throw Err.forbidden('Device disabled');

  // Substitute custom zone names before NLU parsing
  const resolved = await resolveZoneNames(c.env, device_id, transcript);
  const parse = parseVoice(resolved);
  if (parse.error) {
    await c.env.DB.prepare(
      `INSERT INTO voice_logs (id, user_id, device_id, command_text, execution_status)
       VALUES (?1, ?2, ?3, ?4, 'unparsed')`
    ).bind(newId(), u.id, device_id, transcript).run();
    return c.json(
      { error: { code: 'VOICE_PARSE', message: parse.error } },
      400,
    );
  }

  const cmdType: string = parse.parsed?.command_type;

  // ── Information queries — no device command, fetch external data ──────────
  if (cmdType === 'query_weather' || cmdType === 'query_aqi') {
    await c.env.DB.prepare(
      `INSERT INTO voice_logs (id, user_id, device_id, command_text, parsed_command, execution_status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'queried')`
    ).bind(newId(), u.id, device_id, transcript, JSON.stringify(parse.parsed)).run();

    // Build location URL — prefer GPS coords if provided by VoiceButton
    const locPart = (lat != null && lon != null) ? `${lat},${lon}` : '';
    const weatherUrl = locPart
      ? `https://wttr.in/${locPart}?format=j1`
      : 'https://wttr.in/?format=j1';

    try {
      const wr = await fetch(weatherUrl, { cf: { cacheTtl: 300 } } as any);
      if (!wr.ok) throw new Error('wttr.in unavailable');
      const wj = await wr.json() as any;
      const cc = wj.current_condition?.[0];
      const area = wj.nearest_area?.[0];
      const city = area?.areaName?.[0]?.value || area?.region?.[0]?.value || 'your location';

      if (cmdType === 'query_weather') {
        return c.json({
          parsed: parse.parsed,
          result: {
            city,
            temp_c:    parseInt(cc?.temp_C ?? '25'),
            feels_c:   parseInt(cc?.FeelsLikeC ?? '25'),
            humidity:  parseInt(cc?.humidity ?? '60'),
            wind_kph:  parseInt(cc?.windspeedKmph ?? '0'),
            condition: cc?.weatherDesc?.[0]?.value ?? 'Clear',
          },
        });
      }

      // query_aqi — fetch from Open-Meteo using GPS or wttr.in area coords
      const aqLat = lat ?? parseFloat(area?.latitude ?? '0');
      const aqLon = lon ?? parseFloat(area?.longitude ?? '0');
      const aqr = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${aqLat}&longitude=${aqLon}&current=pm10,pm2_5,us_aqi&timezone=auto`
      );
      const aqj = await aqr.json() as any;
      return c.json({
        parsed: parse.parsed,
        result: {
          city,
          us_aqi: aqj.current?.us_aqi ?? null,
          pm2_5:  aqj.current?.pm2_5  ?? null,
          pm10:   aqj.current?.pm10   ?? null,
        },
      });
    } catch {
      return c.json({
        parsed: parse.parsed,
        result: null,
        message: 'Weather data temporarily unavailable.',
      });
    }
  }

  if (cmdType === 'query_status') {
    await c.env.DB.prepare(
      `INSERT INTO voice_logs (id, user_id, device_id, command_text, parsed_command, execution_status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'queried')`
    ).bind(newId(), u.id, device_id, transcript, JSON.stringify(parse.parsed)).run();
    const d = await c.env.DB.prepare(
      `SELECT device_name, status, last_seen_at FROM devices WHERE id=?1`
    ).bind(device_id).first<any>();
    return c.json({ parsed: parse.parsed, result: d ?? { status: 'unknown' } });
  }

  // ── Device action commands ─────────────────────────────────────────────────
  try {
    const command = await enqueue(c.env, {
      userId: u.id,
      deviceId: device_id,
      command: parse.parsed,
      source: 'voice',
    });
    if (command && typeof command.payload === 'string') {
      try { command.payload = JSON.parse(command.payload); } catch {}
    }
    await c.env.DB.prepare(
      `INSERT INTO voice_logs
         (id, user_id, device_id, command_text, parsed_command, execution_status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'queued')`
    ).bind(
      newId(), u.id, device_id, transcript, JSON.stringify(parse.parsed),
    ).run();
    return c.json({ command, parsed: parse.parsed }, 202);
  } catch (e) {
    await c.env.DB.prepare(
      `INSERT INTO voice_logs
         (id, user_id, device_id, command_text, parsed_command, execution_status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'rejected')`
    ).bind(
      newId(), u.id, device_id, transcript, JSON.stringify(parse.parsed),
    ).run();
    throw e;
  }
});

app.get('/logs', async (c) => {
  const u = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM voice_logs WHERE user_id=?1 ORDER BY created_at DESC LIMIT 100`
  ).bind(u.id).all<any>();
  return c.json({ logs: results });
});

export default app;
