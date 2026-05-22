/**
 * Alexa Custom Skill webhook — POST /api/voice/alexa
 *
 * Account Linking (OAuth):
 *   In the Alexa Developer Console, configure OAuth account linking so that
 *   the user's Eptoflow JWT is passed as `session.user.accessToken` on every
 *   request. We verify that token to identify the caller, then check their
 *   subscription before dispatching commands.
 *
 * Intents handled:
 *   LaunchRequest            – greeting
 *   WaterZoneIntent          – "water zone {zone} for {duration} minutes"
 *   StopWateringIntent       – "stop all watering"
 *   TurnOnMotorIntent        – "turn on the motor / pump"
 *   TurnOffMotorIntent       – "turn off the motor / pump"
 *   ValveOnIntent            – "open valve {zone}"
 *   ValveOffIntent           – "close valve {zone}"
 *   CheckStatusIntent        – "what's the status"
 *   CheckWeatherIntent       – "what's the weather"
 *   CheckAQIIntent           – "what's the air quality"
 *   AMAZON.StopIntent        – built-in stop
 *   AMAZON.CancelIntent      – built-in cancel
 *   AMAZON.HelpIntent        – built-in help
 *   SessionEndedRequest      – session cleanup (no response needed)
 */

import { Hono } from 'hono';
import type { AppCtx } from '../lib/middleware';
import { verifyJWT } from '../lib/jwt';
import { newId } from '../lib/ids';
import { enqueue } from '../services/command';

const app = new Hono<AppCtx>();

// ─── Alexa response helpers ──────────────────────────────────────────────────

function alexaResponse(speechText: string, shouldEndSession = true) {
  return {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text: speechText },
      shouldEndSession,
    },
  };
}

function alexaError(msg: string) {
  return alexaResponse(msg);
}

// ─── Resolve zone slot → valve target ────────────────────────────────────────

function resolveZone(slot: any): string {
  if (!slot?.value) return 'valve1';
  const n = parseInt(slot.value, 10);
  if (!isNaN(n) && n >= 1 && n <= 3) return `valve${n}`;
  // Handle spoken words "one", "two", "three"
  const map: Record<string, string> = { one: 'valve1', two: 'valve2', three: 'valve3' };
  return map[slot.value?.toLowerCase()] ?? 'valve1';
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

app.post('/', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json(alexaError('Sorry, I received an invalid request.'));
  }

  const requestType: string = body?.request?.type ?? '';

  // SessionEndedRequest — acknowledge quietly
  if (requestType === 'SessionEndedRequest') {
    return c.json({ version: '1.0', response: {} });
  }

  // ── Verify account linking token ────────────────────────────────────────
  const accessToken: string | undefined =
    body?.session?.user?.accessToken ?? body?.context?.System?.user?.accessToken;

  if (!accessToken) {
    return c.json(
      alexaResponse(
        'Your Eptoflow account is not linked. Please go to the Alexa app and link your account first.',
      ),
    );
  }

  let userId: string;
  let userEmail: string;
  try {
    const payload = await verifyJWT(accessToken, c.env.JWT_SECRET, 'user');
    userId    = payload.sub as string;
    userEmail = payload.email as string;
  } catch {
    return c.json(
      alexaResponse('Your account link has expired. Please re-link your Eptoflow account in the Alexa app.'),
    );
  }

  // ── Check premium subscription ──────────────────────────────────────────
  const sub: any = await c.env.DB.prepare(
    `SELECT plan_name, status, end_date FROM subscriptions
      WHERE user_id=?1 AND status='active'
      ORDER BY end_date DESC LIMIT 1`,
  ).bind(userId).first();

  const subActive =
    sub && sub.status === 'active' &&
    Date.parse((sub.end_date as string).replace(' ', 'T') + 'Z') > Date.now();
  const isPremium = subActive && sub.plan_name === 'premium';

  if (!isPremium) {
    return c.json(
      alexaResponse(
        'Alexa voice control requires an active Eptoflow Premium plan. ' +
        'Please upgrade in the Eptoflow app.',
      ),
    );
  }

  // ── Find user's first online device ────────────────────────────────────
  const device: any = await c.env.DB.prepare(
    `SELECT id, device_name FROM devices
      WHERE user_id=?1 AND enabled=1
      ORDER BY CASE WHEN status='online' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1`,
  ).bind(userId).first();

  // ── Handle request type / intent ────────────────────────────────────────

  if (requestType === 'LaunchRequest') {
    const statusNote = device
      ? `Your device "${device.device_name}" is ready.`
      : 'No active device found. Please add one in the Eptoflow app.';
    return c.json(
      alexaResponse(
        `Welcome to Eptoflow! ${statusNote} You can say things like: ` +
        '"water zone 1 for 5 minutes", "stop watering", or "check the weather".',
        false, // keep session open
      ),
    );
  }

  if (requestType === 'IntentRequest') {
    const intent: string = body.request.intent?.name ?? '';
    const slots          = body.request.intent?.slots ?? {};

    // ── AMAZON built-ins ──────────────────────────────────────────────────
    if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent') {
      return c.json(alexaResponse('Goodbye from Eptoflow!'));
    }

    if (intent === 'AMAZON.HelpIntent') {
      return c.json(
        alexaResponse(
          'With Eptoflow you can say: "water zone 1 for 10 minutes", ' +
          '"stop watering", "open valve 2", "close valve 2", ' +
          '"turn on the motor", "turn off the motor", ' +
          '"check the weather", or "air quality". What would you like to do?',
          false,
        ),
      );
    }

    // ── Query intents (no device needed) ─────────────────────────────────
    if (intent === 'CheckWeatherIntent') {
      return c.json(
        alexaResponse(
          'Check the current weather in your Eptoflow dashboard for location-based conditions. ' +
          'I can send watering commands to your device. What would you like me to do?',
          false,
        ),
      );
    }

    if (intent === 'CheckAQIIntent') {
      return c.json(
        alexaResponse(
          'Check the air quality index in your Eptoflow dashboard. ' +
          'High pollution days are a good reason to water in the evening instead. ' +
          'Shall I set up a watering schedule?',
          false,
        ),
      );
    }

    if (intent === 'CheckStatusIntent') {
      if (!device) {
        return c.json(alexaResponse('No active devices found in your Eptoflow account.'));
      }
      const statusText = device.status === 'online' ? 'online and ready' : 'currently offline';
      return c.json(
        alexaResponse(
          `Your device "${device.device_name}" is ${statusText}. What would you like to do?`,
          false,
        ),
      );
    }

    // ── Action intents (require a device) ────────────────────────────────
    if (!device) {
      return c.json(
        alexaResponse(
          'I could not find an active Eptoflow device on your account. ' +
          'Please add or enable a device in the Eptoflow app.',
        ),
      );
    }

    let command: any = null;
    let confirmText  = '';

    if (intent === 'WaterZoneIntent') {
      const zone     = resolveZone(slots.zone);
      const durSlot  = slots.duration?.value;
      const unit     = slots.unit?.value?.toLowerCase() ?? 'minute';
      const dur      = parseInt(durSlot ?? '5', 10) || 5;
      const duration = unit.startsWith('sec') ? dur : dur * 60;
      const humanDur = unit.startsWith('sec') ? `${dur} seconds` : `${dur} minute${dur !== 1 ? 's' : ''}`;
      command     = { command_type: 'water_for', payload: { target: zone, duration } };
      confirmText = `Watering ${zone} for ${humanDur} on "${device.device_name}".`;
    }
    else if (intent === 'StopWateringIntent') {
      command     = { command_type: 'stop_all', payload: {} };
      confirmText = `Stopping all watering on "${device.device_name}".`;
    }
    else if (intent === 'TurnOnMotorIntent') {
      command     = { command_type: 'relay_on', payload: { target: 'relay1' } };
      confirmText = `Turning on the motor on "${device.device_name}".`;
    }
    else if (intent === 'TurnOffMotorIntent') {
      command     = { command_type: 'relay_off', payload: { target: 'relay1' } };
      confirmText = `Turning off the motor on "${device.device_name}".`;
    }
    else if (intent === 'ValveOnIntent') {
      const zone  = resolveZone(slots.zone);
      command     = { command_type: 'valve_on', payload: { target: zone } };
      confirmText = `Opening ${zone} on "${device.device_name}".`;
    }
    else if (intent === 'ValveOffIntent') {
      const zone  = resolveZone(slots.zone);
      command     = { command_type: 'valve_off', payload: { target: zone } };
      confirmText = `Closing ${zone} on "${device.device_name}".`;
    }
    else {
      return c.json(
        alexaResponse(
          `Sorry, I didn't understand that. Try saying "water zone 1 for 5 minutes" or "stop watering".`,
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
        source: 'alexa',
      });

      // Log to voice_logs
      await c.env.DB.prepare(
        `INSERT INTO voice_logs (id, user_id, device_id, command_text, parsed_command, execution_status)
         VALUES (?1, ?2, ?3, ?4, ?5, 'queued')`,
      ).bind(
        newId(), userId, device.id,
        `[Alexa] ${intent}`,
        JSON.stringify(command),
      ).run();

      return c.json(alexaResponse(confirmText));
    } catch (e: any) {
      console.error('[alexa] enqueue error:', e);
      return c.json(
        alexaResponse(
          `Sorry, I couldn't send that command. Please check your device is online and try again.`,
        ),
      );
    }
  }

  return c.json(alexaError('Sorry, I received an unexpected request type.'));
});

export default app;
