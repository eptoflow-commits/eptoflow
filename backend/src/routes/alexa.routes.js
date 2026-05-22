/**
 * Alexa Custom Skill webhook — POST /api/voice/alexa
 *
 * Account Linking: Users link their Eptoflow account in the Alexa app.
 * The Eptoflow JWT is sent as session.user.accessToken on every request.
 * Premium subscription required.
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { asyncH } from '../utils/http.js';
import { query } from '../db/pool.js';
import { enqueueCommand } from '../services/command.service.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function alexaResponse(speechText, shouldEndSession = true) {
  return {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text: speechText },
      shouldEndSession,
    },
  };
}

function resolveZone(slot) {
  if (!slot?.value) return 'valve1';
  const n = parseInt(slot.value, 10);
  if (!isNaN(n) && n >= 1 && n <= 3) return `valve${n}`;
  const map = { one: 'valve1', two: 'valve2', three: 'valve3' };
  return map[slot.value?.toLowerCase()] ?? 'valve1';
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

router.post('/', asyncH(async (req, res) => {
  const body = req.body ?? {};
  const requestType = body?.request?.type ?? '';

  if (requestType === 'SessionEndedRequest') {
    return res.json({ version: '1.0', response: {} });
  }

  // ── Verify account-link token ────────────────────────────────────────────
  const accessToken =
    body?.session?.user?.accessToken ?? body?.context?.System?.user?.accessToken;

  if (!accessToken) {
    return res.json(
      alexaResponse(
        'Your Eptoflow account is not linked. Please open the Alexa app and link your account.',
      ),
    );
  }

  let userId;
  try {
    const payload = jwt.verify(accessToken, config.jwt.userSecret);
    if (payload.role !== 'user') throw new Error('wrong role');
    userId = payload.sub;
  } catch {
    return res.json(
      alexaResponse('Your Eptoflow account link has expired. Please re-link in the Alexa app.'),
    );
  }

  // ── Check Premium subscription ───────────────────────────────────────────
  const { rows: subRows } = await query(
    `SELECT plan_name, status, end_date FROM subscriptions
      WHERE user_id=$1 AND status='active'
      ORDER BY end_date DESC LIMIT 1`,
    [userId],
  );
  const sub = subRows[0];
  const isPremium =
    sub && sub.status === 'active' &&
    new Date(sub.end_date) > new Date() &&
    sub.plan_name === 'premium';

  if (!isPremium) {
    return res.json(
      alexaResponse(
        'Alexa control requires an active Eptoflow Premium plan. Please upgrade in the Eptoflow app.',
      ),
    );
  }

  // ── Find primary device ──────────────────────────────────────────────────
  const { rows: devRows } = await query(
    `SELECT id, device_name, status FROM devices
      WHERE user_id=$1 AND enabled=true
      ORDER BY CASE WHEN status='online' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1`,
    [userId],
  );
  const device = devRows[0];

  // ── Handle LaunchRequest ─────────────────────────────────────────────────
  if (requestType === 'LaunchRequest') {
    const note = device
      ? `Your device "${device.device_name}" is ready.`
      : 'No active device found. Please add one in the Eptoflow app.';
    return res.json(
      alexaResponse(
        `Welcome to Eptoflow! ${note} Say things like "water zone 1 for 5 minutes", ` +
        '"stop watering", or "check the weather".',
        false,
      ),
    );
  }

  // ── Handle IntentRequest ─────────────────────────────────────────────────
  if (requestType === 'IntentRequest') {
    const intent = body.request.intent?.name ?? '';
    const slots  = body.request.intent?.slots ?? {};

    if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent') {
      return res.json(alexaResponse('Goodbye from Eptoflow!'));
    }

    if (intent === 'AMAZON.HelpIntent') {
      return res.json(
        alexaResponse(
          'You can say: "water zone 1 for 10 minutes", "stop watering", ' +
          '"open valve 2", "turn on the motor", "check the weather", or "air quality".',
          false,
        ),
      );
    }

    if (intent === 'CheckWeatherIntent') {
      return res.json(
        alexaResponse(
          'Check the weather in your Eptoflow dashboard. Shall I schedule a watering session?',
          false,
        ),
      );
    }

    if (intent === 'CheckAQIIntent') {
      return res.json(
        alexaResponse(
          'Check air quality in your Eptoflow dashboard. High-pollution days are good for evening watering.',
          false,
        ),
      );
    }

    if (intent === 'CheckStatusIntent') {
      if (!device) return res.json(alexaResponse('No active devices found in your Eptoflow account.'));
      const s = device.status === 'online' ? 'online and ready' : 'currently offline';
      return res.json(alexaResponse(`Your device "${device.device_name}" is ${s}.`, false));
    }

    if (!device) {
      return res.json(
        alexaResponse(
          'No active Eptoflow device found. Please add or enable a device in the app.',
        ),
      );
    }

    let command = null;
    let confirmText = '';

    if (intent === 'WaterZoneIntent') {
      const zone    = resolveZone(slots.zone);
      const dur     = parseInt(slots.duration?.value ?? '5', 10) || 5;
      const unit    = (slots.unit?.value ?? 'minute').toLowerCase();
      const duration = unit.startsWith('sec') ? dur : dur * 60;
      const humanDur = unit.startsWith('sec') ? `${dur} seconds` : `${dur} minute${dur !== 1 ? 's' : ''}`;
      command     = { command_type: 'water_for', payload: { target: zone, duration } };
      confirmText = `Watering ${zone} for ${humanDur} on "${device.device_name}".`;
    } else if (intent === 'StopWateringIntent') {
      command     = { command_type: 'stop_all', payload: {} };
      confirmText = `Stopping all watering on "${device.device_name}".`;
    } else if (intent === 'TurnOnMotorIntent') {
      command     = { command_type: 'relay_on', payload: { target: 'relay1' } };
      confirmText = `Turning on the motor on "${device.device_name}".`;
    } else if (intent === 'TurnOffMotorIntent') {
      command     = { command_type: 'relay_off', payload: { target: 'relay1' } };
      confirmText = `Turning off the motor on "${device.device_name}".`;
    } else if (intent === 'ValveOnIntent') {
      const zone  = resolveZone(slots.zone);
      command     = { command_type: 'valve_on', payload: { target: zone } };
      confirmText = `Opening ${zone} on "${device.device_name}".`;
    } else if (intent === 'ValveOffIntent') {
      const zone  = resolveZone(slots.zone);
      command     = { command_type: 'valve_off', payload: { target: zone } };
      confirmText = `Closing ${zone} on "${device.device_name}".`;
    } else {
      return res.json(
        alexaResponse(
          "Sorry, I didn't understand that. Try: \"water zone 1 for 5 minutes\" or \"stop watering\".",
          false,
        ),
      );
    }

    try {
      await enqueueCommand({ userId, deviceId: device.id, command, source: 'alexa' });
      await query(
        `INSERT INTO voice_logs (user_id, device_id, command_text, parsed_command, execution_status)
         VALUES ($1,$2,$3,$4,'queued')`,
        [userId, device.id, `[Alexa] ${intent}`, JSON.stringify(command)],
      );
      return res.json(alexaResponse(confirmText));
    } catch (e) {
      console.error('[alexa] enqueue error:', e);
      return res.json(
        alexaResponse("Sorry, I couldn't send that command. Check your device is online and try again."),
      );
    }
  }

  return res.json(alexaResponse('Sorry, I received an unexpected request.'));
}));

export default router;
