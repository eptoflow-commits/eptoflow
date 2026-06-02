/**
 * Relay licensing & automation rules — /api/relays  (Express mirror of CF relays.ts)
 *
 * Routes (user, requires active subscription):
 *   GET  /:deviceId/licenses
 *   GET  /:deviceId/automation
 *   PUT  /:deviceId/automation/:valveKey
 *   DELETE /:deviceId/automation/:valveKey
 *
 * Admin routes:
 *   POST /:deviceId/activate
 *   POST /:deviceId/deactivate
 *   GET  /:deviceId/push-config
 */

import { Router }  from 'express';
import { z }       from 'zod';
import { query }   from '../db/pool.js';
import { authUser, authAdmin, loadSubscription } from '../middleware/auth.js';
import { asyncH, Errors } from '../utils/http.js';
import { randomUUID } from 'crypto';

const router = Router();

const PREMIUM_RELAYS = ['relay6', 'relay7', 'relay8'];
const ALL_VALVES     = ['valve1', 'valve2', 'valve3', 'relay1', 'relay6', 'relay7', 'relay8'];

// ─── Ensure tables exist (Postgres) ──────────────────────────────────────────

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS relay_licenses (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      user_id       UUID NOT NULL REFERENCES users(id),
      relay_key     VARCHAR(20) NOT NULL,
      activated     BOOLEAN NOT NULL DEFAULT FALSE,
      activated_by  UUID REFERENCES admins(id),
      activated_at  TIMESTAMPTZ,
      amount_paid   NUMERIC(10,2) DEFAULT 0,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(device_id, relay_key)
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      user_id         UUID NOT NULL REFERENCES users(id),
      valve_key       VARCHAR(20) NOT NULL,
      enabled         BOOLEAN NOT NULL DEFAULT TRUE,
      mode            VARCHAR(10) NOT NULL DEFAULT 'auto',
      on_moisture_lt  NUMERIC(5,2),
      on_temp_gt      NUMERIC(5,2),
      on_logic        VARCHAR(3) NOT NULL DEFAULT 'AND',
      off_moisture_gt NUMERIC(5,2),
      off_temp_lt     NUMERIC(5,2),
      off_logic       VARCHAR(3) NOT NULL DEFAULT 'AND',
      schedule_start  VARCHAR(5),
      schedule_end    VARCHAR(5),
      max_duration_s  INTEGER NOT NULL DEFAULT 1800,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(device_id, valve_key)
    )
  `).catch(() => {});
}

// Helper to verify device ownership
async function ownDevice(deviceId, userId) {
  const { rows } = await query(
    `SELECT id, user_id FROM devices WHERE id=$1 AND user_id=$2`, [deviceId, userId]
  );
  if (!rows[0]) throw Errors.notFound('Device');
  return rows[0];
}

// ─── GET /:deviceId/licenses ──────────────────────────────────────────────────

router.get('/:deviceId/licenses', authUser, loadSubscription(), asyncH(async (req, res) => {
  await ownDevice(req.params.deviceId, req.user.id);
  await ensureTables();

  const { rows } = await query(
    `SELECT relay_key, activated, activated_at, amount_paid
       FROM relay_licenses WHERE device_id=$1`,
    [req.params.deviceId]
  );

  const existing = Object.fromEntries(rows.map(r => [r.relay_key, r]));
  const licenses = PREMIUM_RELAYS.map(k => ({
    relay_key:    k,
    activated:    !!(existing[k]?.activated),
    activated_at: existing[k]?.activated_at ?? null,
    amount_paid:  existing[k]?.amount_paid  ?? 0,
    label:        k === 'relay6' ? 'MediSpray' : k === 'relay7' ? 'Extra Zone 1' : 'Extra Zone 2',
    price_inr:    50,
  }));

  res.json({ licenses });
}));

// ─── GET /:deviceId/automation ────────────────────────────────────────────────

router.get('/:deviceId/automation', authUser, loadSubscription(), asyncH(async (req, res) => {
  await ownDevice(req.params.deviceId, req.user.id);
  await ensureTables();

  const { rows } = await query(
    `SELECT * FROM automation_rules WHERE device_id=$1 ORDER BY valve_key`,
    [req.params.deviceId]
  );

  res.json({ rules: rows });
}));

// ─── PUT /:deviceId/automation/:valveKey ──────────────────────────────────────

const ruleSchema = z.object({
  enabled:         z.boolean().default(true),
  mode:            z.enum(['manual', 'auto']).default('auto'),
  on_moisture_lt:  z.number().min(0).max(100).nullable().default(null),
  on_temp_gt:      z.number().min(-40).max(80).nullable().default(null),
  on_logic:        z.enum(['AND', 'OR']).default('AND'),
  off_moisture_gt: z.number().min(0).max(100).nullable().default(null),
  off_temp_lt:     z.number().min(-40).max(80).nullable().default(null),
  off_logic:       z.enum(['AND', 'OR']).default('AND'),
  schedule_start:  z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  schedule_end:    z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  max_duration_s:  z.number().min(0).max(7200).default(1800),
});

router.put('/:deviceId/automation/:valveKey', authUser, loadSubscription({ requireActive: true }), asyncH(async (req, res) => {
  const { deviceId, valveKey } = req.params;

  if (!ALL_VALVES.includes(valveKey)) throw Errors.badRequest('Invalid valve key');

  await ownDevice(deviceId, req.user.id);
  await ensureTables();

  // Premium relays must be activated first
  if (PREMIUM_RELAYS.includes(valveKey)) {
    const { rows: [lic] } = await query(
      `SELECT activated FROM relay_licenses WHERE device_id=$1 AND relay_key=$2`,
      [deviceId, valveKey]
    );
    if (!lic?.activated) throw Errors.forbidden(`${valveKey} is not activated on this device`);
  }

  const rule = ruleSchema.parse(req.body);

  await query(`
    INSERT INTO automation_rules
      (id, device_id, user_id, valve_key, enabled, mode,
       on_moisture_lt, on_temp_gt, on_logic,
       off_moisture_gt, off_temp_lt, off_logic,
       schedule_start, schedule_end, max_duration_s)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT(device_id, valve_key) DO UPDATE SET
      enabled=EXCLUDED.enabled, mode=EXCLUDED.mode,
      on_moisture_lt=EXCLUDED.on_moisture_lt, on_temp_gt=EXCLUDED.on_temp_gt,
      on_logic=EXCLUDED.on_logic,
      off_moisture_gt=EXCLUDED.off_moisture_gt, off_temp_lt=EXCLUDED.off_temp_lt,
      off_logic=EXCLUDED.off_logic,
      schedule_start=EXCLUDED.schedule_start, schedule_end=EXCLUDED.schedule_end,
      max_duration_s=EXCLUDED.max_duration_s,
      updated_at=NOW()
  `, [
    randomUUID(), deviceId, req.user.id, valveKey,
    rule.enabled, rule.mode,
    rule.on_moisture_lt, rule.on_temp_gt, rule.on_logic,
    rule.off_moisture_gt, rule.off_temp_lt, rule.off_logic,
    rule.schedule_start, rule.schedule_end, rule.max_duration_s,
  ]);

  // Enqueue sync_automation command (non-fatal if device offline)
  await query(`
    INSERT INTO commands (device_id, user_id, command_type, payload, source)
    VALUES ($1,$2,'sync_automation',$3,'automation')
  `, [deviceId, req.user.id, JSON.stringify({ valve_key: valveKey, rule })]).catch(() => {});

  const { rows: [saved] } = await query(
    `SELECT * FROM automation_rules WHERE device_id=$1 AND valve_key=$2`,
    [deviceId, valveKey]
  );

  res.status(201).json({ rule: saved });
}));

// ─── DELETE /:deviceId/automation/:valveKey ───────────────────────────────────

router.delete('/:deviceId/automation/:valveKey', authUser, loadSubscription(), asyncH(async (req, res) => {
  const { deviceId, valveKey } = req.params;
  await ownDevice(deviceId, req.user.id);
  await ensureTables();

  await query(
    `DELETE FROM automation_rules WHERE device_id=$1 AND valve_key=$2`,
    [deviceId, valveKey]
  );

  res.json({ ok: true });
}));

// ─── Admin: POST /:deviceId/activate ─────────────────────────────────────────

const activateSchema = z.object({
  relay_key:   z.enum(['relay6', 'relay7', 'relay8']),
  amount_paid: z.number().min(0).default(50),
  notes:       z.string().max(200).optional(),
});

router.post('/:deviceId/activate', authAdmin, asyncH(async (req, res) => {
  const { deviceId } = req.params;
  const { relay_key, amount_paid, notes } = activateSchema.parse(req.body);

  await ensureTables();

  await query(`
    INSERT INTO relay_licenses (id, device_id, user_id, relay_key, activated, activated_by, activated_at, amount_paid, notes)
    SELECT gen_random_uuid(), d.id, d.user_id, $1, TRUE, $2, NOW(), $3, $4 FROM devices d WHERE d.id=$5
    ON CONFLICT(device_id, relay_key) DO UPDATE SET
      activated=TRUE, activated_by=EXCLUDED.activated_by,
      activated_at=EXCLUDED.activated_at, amount_paid=EXCLUDED.amount_paid,
      notes=EXCLUDED.notes, updated_at=NOW()
  `, [relay_key, req.admin.id, amount_paid, notes ?? null, deviceId]);

  // Get device to enqueue activate_relay command
  const { rows: [device] } = await query(
    `SELECT id, user_id FROM devices WHERE id=$1`, [deviceId]
  );
  if (!device) throw Errors.notFound('Device');

  await query(`
    INSERT INTO commands (device_id, user_id, command_type, payload, source)
    VALUES ($1,$2,'activate_relay',$3,'admin')
  `, [deviceId, device.user_id, JSON.stringify({ relay_key, activated: true })]).catch(() => {});

  res.json({ ok: true, relay_key, activated: true });
}));

// ─── Admin: POST /:deviceId/deactivate ───────────────────────────────────────

router.post('/:deviceId/deactivate', authAdmin, asyncH(async (req, res) => {
  const { deviceId } = req.params;
  const { relay_key } = z.object({ relay_key: z.enum(['relay6', 'relay7', 'relay8']) })
    .parse(req.body);

  await ensureTables();

  await query(
    `UPDATE relay_licenses SET activated=FALSE, updated_at=NOW()
      WHERE device_id=$1 AND relay_key=$2`,
    [deviceId, relay_key]
  );

  const { rows: [device] } = await query(
    `SELECT id, user_id FROM devices WHERE id=$1`, [deviceId]
  );
  if (device) {
    await query(`
      INSERT INTO commands (device_id, user_id, command_type, payload, source)
      VALUES ($1,$2,'activate_relay',$3,'admin')
    `, [deviceId, device.user_id, JSON.stringify({ relay_key, activated: false })]).catch(() => {});
  }

  res.json({ ok: true, relay_key, activated: false });
}));

// ─── User: POST /:deviceId/request — request activation of a premium output ──

const requestSchema = z.object({
  relay_key: z.enum(['relay6', 'relay7', 'relay8']),
  message:   z.string().max(500).optional(),
});

router.post('/:deviceId/request', authUser, validate(requestSchema), asyncH(async (req, res) => {
  const { deviceId } = req.params;
  const { relay_key, message = '' } = req.body;

  const LABELS: Record<string, string> = {
    relay6: 'MediSpray', relay7: 'Extra Zone 1', relay8: 'Extra Zone 2',
  };
  const label = LABELS[relay_key] ?? relay_key;

  // Store as an admin notification
  await query(`
    CREATE TABLE IF NOT EXISTS relay_requests (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id),
      relay_key   VARCHAR(20) NOT NULL,
      label       VARCHAR(80) NOT NULL,
      message     TEXT,
      status      VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await query(
    `INSERT INTO relay_requests (device_id, user_id, relay_key, label, message)
     VALUES ($1,$2,$3,$4,$5)`,
    [deviceId, req.user.id, relay_key, label, message || null]
  );

  // Notify admin via notifications table
  await query(`
    INSERT INTO notifications (user_id, title, message, type)
    SELECT id, 'New output request', $1, 'relay_request'
    FROM users WHERE role='admin' LIMIT 5
  `, [`User requested "${label}" for device ${deviceId}. Message: ${message || 'none'}`]).catch(() => {});

  res.json({ ok: true, message: 'Request submitted. Admin will activate it shortly.' });
}));

// ─── Admin: GET /requests — list all pending requests ────────────────────────

router.get('/requests', authAdmin, asyncH(async (req, res) => {
  await query(`
    CREATE TABLE IF NOT EXISTS relay_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      relay_key VARCHAR(20) NOT NULL, label VARCHAR(80) NOT NULL,
      message TEXT, status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  const { rows } = await query(`
    SELECT rr.*, u.email, u.full_name, d.device_uid, d.device_name
    FROM relay_requests rr
    JOIN users u ON u.id = rr.user_id
    JOIN devices d ON d.id = rr.device_id
    WHERE rr.status = 'pending'
    ORDER BY rr.created_at DESC
  `);
  res.json({ requests: rows });
}));

// ─── Admin: GET /:deviceId/push-config ───────────────────────────────────────

router.get('/:deviceId/push-config', authAdmin, asyncH(async (req, res) => {
  const { deviceId } = req.params;

  const { rows: [device] } = await query(
    `SELECT id, user_id FROM devices WHERE id=$1`, [deviceId]
  );
  if (!device) throw Errors.notFound('Device');

  await ensureTables();

  const [{ rows: licenses }, { rows: rules }, { rows: zones }] = await Promise.all([
    query(`SELECT relay_key, activated FROM relay_licenses WHERE device_id=$1`, [deviceId]),
    query(`SELECT * FROM automation_rules WHERE device_id=$1 AND enabled=TRUE`, [deviceId]),
    query(`SELECT zone_key, zone_name FROM device_zones WHERE device_id=$1`, [deviceId]).catch(() => ({ rows: [] })),
  ]);

  const payload = { licenses, rules, zones };

  await query(`
    INSERT INTO commands (device_id, user_id, command_type, payload, source)
    VALUES ($1,$2,'push_config',$3,'admin')
  `, [deviceId, device.user_id, JSON.stringify(payload)]);

  res.json({ ok: true, payload });
}));

export default router;
