import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authUser, loadSubscription } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncH, Errors } from '../utils/http.js';
import { randomDeviceUid, randomToken, hashSecret } from '../utils/crypto.js';
import { enqueueCommand } from '../services/command.service.js';
import { audit } from '../utils/audit.js';
import { serializePlan } from '../services/plan.service.js';

const router = Router();

router.use(authUser, loadSubscription());

/** Get the list of devices owned by the user */
router.get('/', asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT id, device_uid, device_name, plan_bound, status, last_seen_at, enabled, firmware_version
       FROM devices
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ devices: rows });
}));

/**
 * Provisions (claims) a new device. Returns the plaintext device_secret ONCE,
 * which the user flashes into firmware.
 */
const provisionSchema = z.object({
  device_name: z.string().max(120).optional(),
});
router.post('/', validate(provisionSchema), asyncH(async (req, res) => {
  if (!req.subscription?.isActive) throw Errors.subscriptionInactive();
  const plan = req.subscription.plan_name;
  const uid = randomDeviceUid();
  const secret = randomToken(24);
  const hash = await hashSecret(secret);
  const { rows } = await query(
    `INSERT INTO devices (user_id, device_uid, device_name, device_secret_hash, plan_bound)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, device_uid, device_name, plan_bound, status, enabled, created_at`,
    [req.user.id, uid, req.body.device_name || 'Eptoflow Device', hash, plan]
  );
  await audit({
    actorType: 'user', actorId: req.user.id, action: 'device.provision',
    entityType: 'device', entityId: rows[0].id, metadata: { uid },
  });
  res.status(201).json({
    device: rows[0],
    // Returned only once — the user must save these into firmware config.
    provisioning: { device_uid: uid, device_secret: secret },
    plan: serializePlan(plan),
  });
}));

/** Get a single device including latest heartbeat / status */
router.get('/:id', asyncH(async (req, res) => {
  let step = 'fetch_device';
  try {
    const { rows } = await query(
      `SELECT * FROM devices WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    const device = rows[0];
    if (!device) throw Errors.notFound('Device');

    step = 'fetch_status_logs';
    let logs = [];
    try {
      const r = await query(
        `SELECT * FROM device_status_logs WHERE device_id=$1 ORDER BY id DESC LIMIT 1`,
        [device.id]
      );
      logs = r.rows;
    } catch (e) {
      console.error('[device/:id] status_logs query failed:', e.message);
    }

    step = 'fetch_commands';
    let recentCmds = [];
    try {
      const r = await query(
        `SELECT id, command_type, payload, status, source, created_at, executed_at
           FROM commands WHERE device_id=$1 ORDER BY created_at DESC LIMIT 20`,
        [device.id]
      );
      recentCmds = r.rows;
    } catch (e) {
      console.error('[device/:id] commands query failed:', e.message);
    }

    step = 'serialize';
    res.json({
      device: {
        id: device.id,
        device_uid: device.device_uid,
        device_name: device.device_name,
        plan_bound: device.plan_bound,
        status: device.status,
        last_seen_at: device.last_seen_at,
        enabled: device.enabled,
        firmware_version: device.firmware_version,
      },
      last_status: logs[0] || null,
      recent_commands: recentCmds,
      plan: serializePlan(device.plan_bound),
    });
  } catch (e) {
    if (e.status) throw e; // re-throw ApiErrors (like notFound)
    console.error(`[device/:id] failed at step=${step}:`, e.message);
    throw Errors.server(`Device load failed at ${step}: ${e.message}`);
  }
}));

/** Send a command to a device (user-initiated) */
const commandSchema = z.object({
  command_type: z.string().min(1),
  payload: z.record(z.any()).default({}),
  source: z.enum(['manual', 'voice', 'schedule', 'automation']).default('manual'),
});
router.post(
  '/:id/commands',
  validate(commandSchema),
  asyncH(async (req, res) => {
    const { rows } = await query(
      `SELECT id, enabled FROM devices WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    const device = rows[0];
    if (!device) throw Errors.notFound('Device');
    if (!device.enabled) throw Errors.forbidden('Device disabled by admin');
    const command = await enqueueCommand({
      userId: req.user.id,
      deviceId: device.id,
      command: req.body,
      source: req.body.source,
    });
    res.status(202).json({ command });
  })
);

/** Delete a device */
router.delete('/:id', asyncH(async (req, res) => {
  const { rowCount } = await query(
    `DELETE FROM devices WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.user.id]
  );
  if (!rowCount) throw Errors.notFound('Device');
  res.json({ ok: true });
}));

// ── Zone names ─────────────────────────────────────────────────────────────
const ZONE_KEYS = ['valve1', 'valve2', 'valve3', 'relay1'];
const ZONE_DEFAULTS = {
  valve1: 'Zone 1', valve2: 'Zone 2', valve3: 'Zone 3', relay1: 'Main Motor',
};

const zoneSchema = z.object({
  zones: z.record(
    z.enum(['valve1', 'valve2', 'valve3', 'relay1']),
    z.string().min(1).max(40).trim(),
  ),
});

/** GET /api/devices/:id/zones */
router.get('/:id/zones', asyncH(async (req, res) => {
  const { rows: devRows } = await query(
    `SELECT id FROM devices WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.user.id]
  );
  if (!devRows[0]) throw Errors.notFound('Device');

  await query(`
    CREATE TABLE IF NOT EXISTS device_zones (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id  UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      zone_key   VARCHAR(20) NOT NULL,
      zone_name  VARCHAR(80) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(device_id, zone_key)
    )
  `);

  const { rows } = await query(
    `SELECT zone_key, zone_name FROM device_zones WHERE device_id=$1`,
    [req.params.id]
  );
  const named = Object.fromEntries(rows.map(r => [r.zone_key, r.zone_name]));
  const zones = Object.fromEntries(ZONE_KEYS.map(k => [k, named[k] ?? ZONE_DEFAULTS[k]]));
  res.json({ zones });
}));

/** PATCH /api/devices/:id/zones */
router.patch('/:id/zones', asyncH(async (req, res) => {
  const { rows: devRows } = await query(
    `SELECT id FROM devices WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.user.id]
  );
  if (!devRows[0]) throw Errors.notFound('Device');

  const { zones } = zoneSchema.parse(req.body);

  await query(`
    CREATE TABLE IF NOT EXISTS device_zones (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id  UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      zone_key   VARCHAR(20) NOT NULL,
      zone_name  VARCHAR(80) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(device_id, zone_key)
    )
  `);

  for (const [key, name] of Object.entries(zones)) {
    await query(
      `INSERT INTO device_zones (device_id, user_id, zone_key, zone_name)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT(device_id, zone_key)
       DO UPDATE SET zone_name=EXCLUDED.zone_name, updated_at=NOW()`,
      [req.params.id, req.user.id, key, name]
    );
  }

  const { rows } = await query(
    `SELECT zone_key, zone_name FROM device_zones WHERE device_id=$1`,
    [req.params.id]
  );
  const named = Object.fromEntries(rows.map(r => [r.zone_key, r.zone_name]));
  const allZones = Object.fromEntries(ZONE_KEYS.map(k => [k, named[k] ?? ZONE_DEFAULTS[k]]));
  res.json({ zones: allZones });
}));

export default router;
