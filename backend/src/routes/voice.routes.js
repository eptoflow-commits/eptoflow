import { Router } from 'express';
import { z } from 'zod';
import { authUser, loadSubscription, requirePlan } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncH, Errors } from '../utils/http.js';
import { query } from '../db/pool.js';
import { parseVoiceCommand } from '../services/voice.service.js';
import { enqueueCommand } from '../services/command.service.js';

const router = Router();
router.use(authUser, loadSubscription({ requireActive: true }), requirePlan('premium'));

const schema = z.object({
  device_id:  z.string().uuid(),
  transcript: z.string().min(1).max(400),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

/** Replace custom zone names with canonical keys before NLU parsing. */
async function resolveZoneNames(deviceId, transcript) {
  try {
    const { rows } = await query(
      `SELECT zone_key, zone_name FROM device_zones WHERE device_id=$1`,
      [deviceId]
    );
    if (!rows.length) return transcript;
    const sorted = [...rows].sort((a, b) => b.zone_name.length - a.zone_name.length);
    let t = transcript;
    for (const { zone_key, zone_name } of sorted) {
      const re = new RegExp(zone_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      t = t.replace(re, zone_key);
    }
    return t;
  } catch {
    return transcript;
  }
}

router.post('/command', validate(schema), asyncH(async (req, res) => {
  const { device_id, transcript } = req.body;
  const { rows } = await query(
    `SELECT id, plan_bound, enabled FROM devices WHERE id=$1 AND user_id=$2`,
    [device_id, req.user.id]
  );
  const device = rows[0];
  if (!device) throw Errors.notFound('Device');
  if (!device.enabled) throw Errors.forbidden('Device disabled');

  const resolved = await resolveZoneNames(device_id, transcript);
  const parse = parseVoiceCommand(resolved);
  if (parse.error) {
    await query(
      `INSERT INTO voice_logs (user_id, device_id, command_text, execution_status)
       VALUES ($1,$2,$3,'unparsed')`,
      [req.user.id, device_id, transcript]
    );
    return res.status(400).json({ error: { code: 'VOICE_PARSE', message: parse.error } });
  }

  try {
    const command = await enqueueCommand({
      userId: req.user.id,
      deviceId: device_id,
      command: parse.parsed,
      source: 'voice',
    });
    await query(
      `INSERT INTO voice_logs (user_id, device_id, command_text, parsed_command, execution_status)
       VALUES ($1,$2,$3,$4,'queued')`,
      [req.user.id, device_id, transcript, JSON.stringify(parse.parsed)]
    );
    res.status(202).json({ command, parsed: parse.parsed });
  } catch (e) {
    await query(
      `INSERT INTO voice_logs (user_id, device_id, command_text, parsed_command, execution_status)
       VALUES ($1,$2,$3,$4,'rejected')`,
      [req.user.id, device_id, transcript, JSON.stringify(parse.parsed)]
    );
    throw e;
  }
}));

router.get('/logs', asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM voice_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ logs: rows });
}));

export default router;
