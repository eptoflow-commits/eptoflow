/**
 * Google Conversational Actions webhook — POST /api/voice/google
 *
 * Account Linking (OAuth):
 *   In the Actions Console enable OAuth account linking. Google passes the
 *   user's Eptoflow JWT as `user.accountLinkingToken` (pre-v3 Actions SDK)
 *   or via the `user.params.eptoflow_token` user storage. We verify it to
 *   identify the caller and check their Premium subscription.
 *
 * Scenes / Intents (configure matching names in the Actions console):
 *   actions.intent.MAIN     – entry / welcome
 *   WaterZone               – "water zone 1 for 5 minutes"
 *   StopWatering            – "stop watering"
 *   TurnOnMotor             – "turn on the motor"
 *   TurnOffMotor            – "turn off the motor"
 *   OpenValve               – "open valve 2"
 *   CloseValve              – "close valve 2"
 *   CheckStatus             – "check status"
 *   CheckWeather            – "what's the weather"
 *   CheckAQI                – "air quality"
 *   actions.intent.NO_INPUT – user was silent
 */

import { Hono } from 'hono';
import type { AppCtx } from '../lib/middleware';
import { verifyJWT } from '../lib/jwt';
import { newId } from '../lib/ids';
import { enqueue } from '../services/command';

const app = new Hono<AppCtx>();

// ─── Google Actions response helpers ─────────────────────────────────────────

function googleResponse(speech: string, endConversation = true) {
  return {
    fulfillmentResponse: {
      messages: [{ text: { variants: [{ speech }] } }],
    },
    ...(endConversation ? { scene: { next: { name: 'actions.scene.END_CONVERSATION' } } } : {}),
  };
}

// ─── Slot value helper ────────────────────────────────────────────────────────

function slotValue(body: any, paramName: string): string | undefined {
  // Actions SDK v3 uses intent.params; older format uses parameters
  return (
    body?.intent?.params?.[paramName]?.resolved ??
    body?.queryResult?.parameters?.[paramName]
  );
}

function resolveZone(raw: string | undefined): string {
  if (!raw) return 'valve1';
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n >= 1 && n <= 3) return `valve${n}`;
  const map: Record<string, string> = { one: 'valve1', two: 'valve2', three: 'valve3' };
  return map[raw?.toLowerCase()] ?? 'valve1';
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

app.post('/', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json(googleResponse('Sorry, I received an invalid request from your device.'));
  }

  // Intent name — Actions SDK v3 or Dialogflow format
  const intentName: string =
    body?.intent?.name ??
    body?.handler?.name ??
    body?.queryResult?.intent?.displayName ??
    '';

  // ── Extract account link token ─────────────────────────────────────────
  const accessToken: string | undefined =
    body?.user?.accountLinkingToken ??
    body?.user?.params?.eptoflow_token ??
    body?.originalDetectIntentRequest?.payload?.user?.accessToken;

  if (!accessToken) {
    return c.json(
      googleResponse(
        'Your Eptoflow account is not linked. Please open the Google Home app, ' +
        'find the Eptoflow action, and link your account.',
      ),
    );
  }

  // ── Verify JWT ─────────────────────────────────────────────────────────
  let userId: string;
  try {
    const payload = await verifyJWT(accessToken, c.env.JWT_SECRET, 'user');
    userId = payload.sub as string;
  } catch {
    return c.json(
      googleResponse(
        'Your Eptoflow account link has expired. Please re-link your account in the Google Home app.',
      ),
    );
  }

  // ── Check Premium subscription ─────────────────────────────────────────
  const sub: any = await c.env.DB.prepare(
    `SELECT plan_name, status, end_date FROM subscriptions
      WHERE user_id=?1 AND status='active'
      ORDER BY end_date DESC LIMIT 1`,
  ).bind(userId).first();

  const subActive =
    sub && sub.status === 'active' &&
    Date.parse((sub.end_date as string).replace(' ', 'T') + 'Z') > Date.now();

  if (!subActive || sub.plan_name !== 'premium') {
    return c.json(
      googleResponse(
        'Google Assistant control requires an active Eptoflow Premium subscription. ' +
        'Please upgrade in the Eptoflow app.',
      ),
    );
  }

  // ── Find user's primary device ─────────────────────────────────────────
  const device: any = await c.env.DB.prepare(
    `SELECT id, device_name, status FROM devices
      WHERE user_id=?1 AND enabled=1
      ORDER BY CASE WHEN status='online' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1`,
  ).bind(userId).first();

  // ── Welcome / main entry ───────────────────────────────────────────────
  if (intentName === 'actions.intent.MAIN' || intentName === 'Welcome') {
    const note = device
      ? `Your device "${device.device_name}" is ${device.status}.`
      : 'No active device found — please add one in the Eptoflow app.';
    return c.json(
      googleResponse(
        `Welcome to Eptoflow! ${note} ` +
        'You can say: "water zone 1 for 5 minutes", "stop watering", ' +
        '"check the weather", or "what\'s the air quality"?',
        false,
      ),
    );
  }

  // ── Query intents ──────────────────────────────────────────────────────
  if (intentName === 'CheckWeather') {
    return c.json(
      googleResponse(
        'You can check real-time weather in your Eptoflow dashboard. ' +
        'Based on local conditions, I can schedule watering automatically. ' +
        'Shall I water a zone now?',
        false,
      ),
    );
  }

  if (intentName === 'CheckAQI') {
    return c.json(
      googleResponse(
        'Check the air quality in your Eptoflow dashboard. ' +
        'On high-pollution days, watering in the evening reduces dust. ' +
        'Would you like me to water a zone?',
        false,
      ),
    );
  }

  if (intentName === 'CheckStatus') {
    if (!device) {
      return c.json(googleResponse('No active Eptoflow device found on your account.'));
    }
    const s = device.status === 'online' ? 'online and ready' : 'currently offline';
    return c.json(
      googleResponse(`Your device "${device.device_name}" is ${s}.`, false),
    );
  }

  // ── Silent / no input ─────────────────────────────────────────────────
  if (intentName === 'actions.intent.NO_INPUT') {
    return c.json(googleResponse("I didn't catch that. Try saying 'water zone 1 for 5 minutes'.", false));
  }

  // ── Action intents — require device ───────────────────────────────────
  if (!device) {
    return c.json(
      googleResponse(
        'I could not find an active Eptoflow device. Please add or enable a device in the app.',
      ),
    );
  }

  let command: any = null;
  let confirmText  = '';

  if (intentName === 'WaterZone') {
    const zone     = resolveZone(slotValue(body, 'zone'));
    const durRaw   = slotValue(body, 'duration');
    const unitRaw  = (slotValue(body, 'unit') ?? 'minute').toLowerCase();
    const dur      = parseInt(durRaw ?? '5', 10) || 5;
    const duration = unitRaw.startsWith('sec') ? dur : dur * 60;
    const humanDur = unitRaw.startsWith('sec') ? `${dur} seconds` : `${dur} minute${dur !== 1 ? 's' : ''}`;
    command     = { command_type: 'water_for', payload: { target: zone, duration } };
    confirmText = `Watering ${zone} for ${humanDur} on "${device.device_name}".`;
  }
  else if (intentName === 'StopWatering') {
    command     = { command_type: 'stop_all', payload: {} };
    confirmText = `All watering stopped on "${device.device_name}".`;
  }
  else if (intentName === 'TurnOnMotor') {
    command     = { command_type: 'relay_on', payload: { target: 'relay1' } };
    confirmText = `Motor turned on for "${device.device_name}".`;
  }
  else if (intentName === 'TurnOffMotor') {
    command     = { command_type: 'relay_off', payload: { target: 'relay1' } };
    confirmText = `Motor turned off for "${device.device_name}".`;
  }
  else if (intentName === 'OpenValve') {
    const zone  = resolveZone(slotValue(body, 'zone'));
    command     = { command_type: 'valve_on', payload: { target: zone } };
    confirmText = `${zone} opened on "${device.device_name}".`;
  }
  else if (intentName === 'CloseValve') {
    const zone  = resolveZone(slotValue(body, 'zone'));
    command     = { command_type: 'valve_off', payload: { target: zone } };
    confirmText = `${zone} closed on "${device.device_name}".`;
  }
  else {
    return c.json(
      googleResponse(
        "Sorry, I didn't understand that. Try saying 'water zone 1 for 5 minutes' or 'stop watering'.",
        false,
      ),
    );
  }

  // ── Dispatch command ──────────────────────────────────────────────────
  try {
    await enqueue(c.env, {
      userId,
      deviceId: device.id,
      command,
      source: 'google_assistant',
    });

    await c.env.DB.prepare(
      `INSERT INTO voice_logs (id, user_id, device_id, command_text, parsed_command, execution_status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'queued')`,
    ).bind(
      newId(), userId, device.id,
      `[Google] ${intentName}`,
      JSON.stringify(command),
    ).run();

    return c.json(googleResponse(confirmText));
  } catch (e: any) {
    console.error('[google] enqueue error:', e);
    return c.json(
      googleResponse(
        "Sorry, I couldn't send the command. Please check your device is online and try again.",
      ),
    );
  }
});

export default app;
