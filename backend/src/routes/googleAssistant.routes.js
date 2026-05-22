/**
 * Google Conversational Actions webhook — POST /api/voice/google
 *
 * Account Linking: Google passes the user's Eptoflow JWT as
 * user.accountLinkingToken on each request.
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

function googleResponse(speech, endConversation = true) {
  return {
    fulfillmentResponse: {
      messages: [{ text: { variants: [{ speech }] } }],
    },
    ...(endConversation
      ? { scene: { next: { name: 'actions.scene.END_CONVERSATION' } } }
      : {}),
  };
}

function slotValue(body, paramName) {
  return (
    body?.intent?.params?.[paramName]?.resolved ??
    body?.queryResult?.parameters?.[paramName]
  );
}

function resolveZone(raw) {
  if (!raw) return 'valve1';
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n >= 1 && n <= 3) return `valve${n}`;
  const map = { one: 'valve1', two: 'valve2', three: 'valve3' };
  return map[raw?.toLowerCase()] ?? 'valve1';
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

router.post('/', asyncH(async (req, res) => {
  const body = req.body ?? {};
  const intentName =
    body?.intent?.name ??
    body?.handler?.name ??
    body?.queryResult?.intent?.displayName ??
    '';

  // ── Verify account link token ───────────────────────────────────────────
  const accessToken =
    body?.user?.accountLinkingToken ??
    body?.user?.params?.eptoflow_token ??
    body?.originalDetectIntentRequest?.payload?.user?.accessToken;

  if (!accessToken) {
    return res.json(
      googleResponse(
        'Your Eptoflow account is not linked. Please open the Google Home app and link your account.',
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
      googleResponse('Your Eptoflow account link has expired. Please re-link in the Google Home app.'),
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
      googleResponse(
        'Google Assistant control requires an active Eptoflow Premium plan. Please upgrade in the app.',
      ),
    );
  }

  // ── Find primary device ─────────────────────────────────────────────────
  const { rows: devRows } = await query(
    `SELECT id, device_name, status FROM devices
      WHERE user_id=$1 AND enabled=true
      ORDER BY CASE WHEN status='online' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1`,
    [userId],
  );
  const device = devRows[0];

  // ── Welcome ─────────────────────────────────────────────────────────────
  if (intentName === 'actions.intent.MAIN' || intentName === 'Welcome') {
    const note = device
      ? `Your device "${device.device_name}" is ${device.status}.`
      : 'No active device found — please add one in the Eptoflow app.';
    return res.json(
      googleResponse(
        `Welcome to Eptoflow! ${note} Say "water zone 1 for 5 minutes", ` +
        '"stop watering", or "check the weather".',
        false,
      ),
    );
  }

  // ── Query intents ────────────────────────────────────────────────────────
  if (intentName === 'CheckWeather') {
    return res.json(
      googleResponse(
        'Check real-time weather in your Eptoflow dashboard. Shall I water a zone now?',
        false,
      ),
    );
  }

  if (intentName === 'CheckAQI') {
    return res.json(
      googleResponse(
        'Check air quality in your Eptoflow dashboard. Would you like to schedule evening watering?',
        false,
      ),
    );
  }

  if (intentName === 'CheckStatus') {
    if (!device) return res.json(googleResponse('No active Eptoflow device found.'));
    const s = device.status === 'online' ? 'online and ready' : 'currently offline';
    return res.json(googleResponse(`Your device "${device.device_name}" is ${s}.`, false));
  }

  if (intentName === 'actions.intent.NO_INPUT') {
    return res.json(googleResponse("I didn't catch that. Try: 'water zone 1 for 5 minutes'.", false));
  }

  // ── Action intents ────────────────────────────────────────────────────────
  if (!device) {
    return res.json(
      googleResponse('No active Eptoflow device found. Please add or enable a device in the app.'),
    );
  }

  let command = null;
  let confirmText = '';

  if (intentName === 'WaterZone') {
    const zone     = resolveZone(slotValue(body, 'zone'));
    const durRaw   = slotValue(body, 'duration');
    const unitRaw  = (slotValue(body, 'unit') ?? 'minute').toLowerCase();
    const dur      = parseInt(durRaw ?? '5', 10) || 5;
    const duration = unitRaw.startsWith('sec') ? dur : dur * 60;
    const humanDur = unitRaw.startsWith('sec') ? `${dur} seconds` : `${dur} minute${dur !== 1 ? 's' : ''}`;
    command     = { command_type: 'water_for', payload: { target: zone, duration } };
    confirmText = `Watering ${zone} for ${humanDur} on "${device.device_name}".`;
  } else if (intentName === 'StopWatering') {
    command     = { command_type: 'stop_all', payload: {} };
    confirmText = `All watering stopped on "${device.device_name}".`;
  } else if (intentName === 'TurnOnMotor') {
    command     = { command_type: 'relay_on', payload: { target: 'relay1' } };
    confirmText = `Motor turned on for "${device.device_name}".`;
  } else if (intentName === 'TurnOffMotor') {
    command     = { command_type: 'relay_off', payload: { target: 'relay1' } };
    confirmText = `Motor turned off for "${device.device_name}".`;
  } else if (intentName === 'OpenValve') {
    const zone  = resolveZone(slotValue(body, 'zone'));
    command     = { command_type: 'valve_on', payload: { target: zone } };
    confirmText = `${zone} opened on "${device.device_name}".`;
  } else if (intentName === 'CloseValve') {
    const zone  = resolveZone(slotValue(body, 'zone'));
    command     = { command_type: 'valve_off', payload: { target: zone } };
    confirmText = `${zone} closed on "${device.device_name}".`;
  } else {
    return res.json(
      googleResponse(
        "Sorry, I didn't understand. Try: 'water zone 1 for 5 minutes' or 'stop watering'.",
        false,
      ),
    );
  }

  try {
    await enqueueCommand({ userId, deviceId: device.id, command, source: 'google_assistant' });
    await query(
      `INSERT INTO voice_logs (user_id, device_id, command_text, parsed_command, execution_status)
       VALUES ($1,$2,$3,$4,'queued')`,
      [userId, device.id, `[Google] ${intentName}`, JSON.stringify(command)],
    );
    return res.json(googleResponse(confirmText));
  } catch (e) {
    console.error('[google] enqueue error:', e);
    return res.json(
      googleResponse("Sorry, I couldn't send the command. Check your device is online and try again."),
    );
  }
}));

export default router;
