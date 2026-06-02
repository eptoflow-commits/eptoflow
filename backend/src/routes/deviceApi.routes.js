/**
 * Device-facing API used by ESP32 firmware.
 *
 * Endpoints:
 *   POST  /api/device/auth        -- { device_uid, device_secret } -> { token }
 *   POST  /api/device/heartbeat   -- state payload  [auth: device]
 *   GET   /api/device/next        -- fetch next pending command  [auth: device]
 *   POST  /api/device/ack/:cmdId  -- ack executed/failed         [auth: device]
 */
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authDevice, signDeviceToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncH, Errors } from '../utils/http.js';
import { compareSecret } from '../utils/crypto.js';
import { fetchNextCommand, ackCommand } from '../services/command.service.js';
import { isSubscriptionActive, getLatestSubscription } from '../services/subscription.service.js';
import { audit } from '../utils/audit.js';

const router = Router();

const authSchema = z.object({
  device_uid: z.string().min(4),
  device_secret: z.string().min(8),
  firmware_version: z.string().max(40).optional(),
});

router.post('/auth', validate(authSchema), asyncH(async (req, res) => {
  const { device_uid, device_secret, firmware_version } = req.body;
  const { rows } = await query('SELECT * FROM devices WHERE device_uid=$1', [device_uid]);
  const device = rows[0];
  if (!device) throw Errors.unauthorized('Unknown device');
  if (!device.enabled) throw Errors.forbidden('Device disabled');
  const ok = await compareSecret(device_secret, device.device_secret_hash);
  if (!ok) throw Errors.unauthorized('Bad secret');

  await query(
    `UPDATE devices SET firmware_version=COALESCE($2, firmware_version),
                        last_seen_at=NOW(),
                        status='online'
      WHERE id=$1`,
    [device.id, firmware_version || null]
  );
  await audit({ actorType: 'device', actorId: device.id, action: 'device.auth' });

  res.json({
    token: signDeviceToken(device),
    device: {
      id: device.id,
      device_uid: device.device_uid,
      plan_bound: device.plan_bound,
    },
  });
}));

const heartbeatSchema = z.object({
  relay1_state:   z.boolean().optional(),
  valve1_state:   z.boolean().optional(),
  valve2_state:   z.boolean().optional(),
  valve3_state:   z.boolean().optional(),
  moisture_value: z.number().int().optional(),
  wifi_rssi:      z.number().int().optional(),
  ip:             z.string().max(64).optional(),
  uptime_ms:      z.number().int().optional(),
}).passthrough();

router.post(
  '/heartbeat',
  authDevice,
  validate(heartbeatSchema),
  asyncH(async (req, res) => {
    const body = req.body;
    await query(
      `UPDATE devices SET last_seen_at=NOW(), status='online',
                          last_known_ip=COALESCE($2, last_known_ip)
        WHERE id=$1`,
      [req.device.id, body.ip || null]
    );
    await query(
      `INSERT INTO device_status_logs
         (device_id, relay1_state, valve1_state, valve2_state, valve3_state,
          moisture_value, wifi_rssi, raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        req.device.id,
        body.relay1_state ?? null,
        body.valve1_state ?? null,
        body.valve2_state ?? null,
        body.valve3_state ?? null,
        body.moisture_value ?? null,
        body.wifi_rssi ?? null,
        JSON.stringify(body),
      ]
    );

    // Return whether the owning user's subscription is active so firmware can
    // lock down paid features if needed.
    const { rows } = await query(
      `SELECT user_id, plan_bound FROM devices WHERE id=$1`, [req.device.id]
    );
    const sub = rows[0]?.user_id ? await getLatestSubscription(rows[0].user_id) : null;
    const active = isSubscriptionActive(sub);

    res.json({
      ok: true,
      subscription_active: active,
      plan_bound: rows[0]?.plan_bound,
      server_time: new Date().toISOString(),
    });
  })
);

router.get('/next', authDevice, asyncH(async (req, res) => {
  // Reject delivery if subscription is inactive (backend = source of truth)
  const { rows } = await query(`SELECT user_id FROM devices WHERE id=$1`, [req.device.id]);
  const userId = rows[0]?.user_id;
  const sub = userId ? await getLatestSubscription(userId) : null;
  if (!isSubscriptionActive(sub)) return res.json({ command: null, subscription_active: false });

  const cmd = await fetchNextCommand(req.device.id);
  res.json({ command: cmd, subscription_active: true });
}));

const ackSchema = z.object({
  status: z.enum(['executed', 'failed']),
  error: z.string().max(500).optional(),
});
router.post(
  '/ack/:cmdId',
  authDevice,
  validate(ackSchema),
  asyncH(async (req, res) => {
    const command = await ackCommand(req.device.id, req.params.cmdId, req.body);
    if (!command) throw Errors.notFound('Command');
    res.json({ command });
  })
);

// ── POST /api/device/sensor — store sensor reading from ESP32 ────────────────
const sensorSchema = z.object({
  sensor_addr:  z.number().int().optional(),
  moisture_pct: z.number().nullable().optional(),
  temp_c:       z.number().nullable().optional(),
  raw_moisture: z.number().int().optional(),
  raw_temp:     z.number().int().optional(),
  read_ok:      z.boolean().optional(),
});

router.post(
  '/sensor',
  authDevice,
  validate(sensorSchema),
  asyncH(async (req, res) => {
    const {
      sensor_addr  = 1,
      moisture_pct = null,
      temp_c       = null,
      raw_moisture = null,
      raw_temp     = null,
      read_ok      = true,
    } = req.body;

    // Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id    UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        sensor_addr  INTEGER NOT NULL DEFAULT 1,
        moisture_pct NUMERIC(6,2),
        temp_c       NUMERIC(6,2),
        raw_moisture INTEGER,
        raw_temp     INTEGER,
        read_ok      BOOLEAN NOT NULL DEFAULT TRUE,
        recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(() => {});

    await query(
      `INSERT INTO sensor_readings
         (device_id, sensor_addr, moisture_pct, temp_c, raw_moisture, raw_temp, read_ok)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.device.id, sensor_addr, moisture_pct, temp_c, raw_moisture, raw_temp, read_ok]
    );

    // Update device last_seen
    await query(
      `UPDATE devices SET last_seen_at=NOW(), status='online' WHERE id=$1`,
      [req.device.id]
    );

    res.json({ ok: true });
  })
);

export default router;
