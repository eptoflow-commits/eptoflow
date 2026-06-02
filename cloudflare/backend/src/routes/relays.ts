/**
 * Relay licensing & automation rules — /api/relays
 *
 * Premium add-on relays 6, 7, 8 cost ₹50 each to activate.
 * Admin activates them from the admin panel; device fetches its active list
 * on boot and stores in NVS so it survives internet outages.
 *
 * Routes (all require authUser + active subscription):
 *   GET  /api/relays/:deviceId/licenses     — list relay license state (all 3 premium)
 *   GET  /api/relays/:deviceId/automation   — list automation rules per valve
 *   PUT  /api/relays/:deviceId/automation/:valveKey — upsert automation rule
 *   DELETE /api/relays/:deviceId/automation/:valveKey — delete rule (→ manual mode)
 *
 * Admin routes (require authAdmin):
 *   POST /api/relays/:deviceId/activate     — activate a premium relay
 *   POST /api/relays/:deviceId/deactivate   — deactivate a premium relay
 *   GET  /api/relays/:deviceId/push-config  — push current config to device via command queue
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppCtx } from '../lib/middleware';
import { authUser, authAdmin, loadSubscription } from '../lib/middleware';
import { Err } from '../lib/errors';
import { newId } from '../lib/ids';
import { enqueue } from '../services/command';

const app = new Hono<AppCtx>();

const PREMIUM_RELAYS = ['relay6', 'relay7', 'relay8'] as const;
const ALL_VALVES     = ['valve1', 'valve2', 'valve3', 'relay1', 'relay6', 'relay7', 'relay8'] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

async function ensureTables(db: any) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS relay_licenses (
    id TEXT PRIMARY KEY, device_id TEXT NOT NULL, user_id TEXT NOT NULL,
    relay_key TEXT NOT NULL, activated INTEGER NOT NULL DEFAULT 0,
    activated_by TEXT, activated_at TEXT, amount_paid REAL DEFAULT 0, notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(device_id, relay_key))`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY, device_id TEXT NOT NULL, user_id TEXT NOT NULL,
    valve_key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL DEFAULT 'auto',
    on_moisture_lt REAL, on_temp_gt REAL, on_logic TEXT DEFAULT 'AND',
    off_moisture_gt REAL, off_temp_lt REAL, off_logic TEXT DEFAULT 'AND',
    schedule_start TEXT, schedule_end TEXT, max_duration_s INTEGER NOT NULL DEFAULT 1800,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(device_id, valve_key))`).run();
}

// ─── User routes ─────────────────────────────────────────────────────────────

/** GET /api/relays/:deviceId/licenses — which premium relays are active */
app.get('/:deviceId/licenses', authUser, loadSubscription(), async (c) => {
  const u        = c.get('user')!;
  const deviceId = c.req.param('deviceId');

  const device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(deviceId, u.id).first<any>();
  if (!device) throw Err.notFound('Device');

  await ensureTables(c.env.DB);

  const { results } = await c.env.DB.prepare(
    `SELECT relay_key, activated, activated_at, amount_paid FROM relay_licenses WHERE device_id=?1`
  ).bind(deviceId).all<any>();

  // Build full map including un-created entries (default locked)
  const existing = Object.fromEntries(results.map((r: any) => [r.relay_key, r]));
  const licenses = PREMIUM_RELAYS.map((k) => ({
    relay_key:    k,
    activated:    !!(existing[k]?.activated),
    activated_at: existing[k]?.activated_at ?? null,
    amount_paid:  existing[k]?.amount_paid  ?? 0,
    label:        `Add-on Valve ${k.replace('relay', '')}`,
    price_inr:    50,
  }));

  return c.json({ licenses });
});

/** GET /api/relays/:deviceId/automation — all automation rules */
app.get('/:deviceId/automation', authUser, loadSubscription(), async (c) => {
  const u        = c.get('user')!;
  const deviceId = c.req.param('deviceId');

  const device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(deviceId, u.id).first<any>();
  if (!device) throw Err.notFound('Device');

  await ensureTables(c.env.DB);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM automation_rules WHERE device_id=?1 ORDER BY valve_key`
  ).bind(deviceId).all<any>();

  return c.json({ rules: results });
});

const ruleSchema = z.object({
  enabled:        z.union([z.boolean(), z.number().int()]).transform(v => !!v).default(true),
  mode:           z.enum(['manual', 'auto']).default('auto'),
  on_moisture_lt: z.number().min(0).max(100).nullable().default(null),
  on_temp_gt:     z.number().min(-40).max(80).nullable().default(null),
  on_logic:       z.enum(['AND', 'OR']).default('AND'),
  off_moisture_gt:z.number().min(0).max(100).nullable().default(null),
  off_temp_lt:    z.number().min(-40).max(80).nullable().default(null),
  off_logic:      z.enum(['AND', 'OR']).default('AND'),
  schedule_start: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  schedule_end:   z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  max_duration_s: z.number().min(0).max(7200).default(1800),
});

/** PUT /api/relays/:deviceId/automation/:valveKey — create or replace rule */
app.put('/:deviceId/automation/:valveKey', authUser, loadSubscription({ requireActive: true }), async (c) => {
  const u        = c.get('user')!;
  const deviceId = c.req.param('deviceId');
  const valveKey = c.req.param('valveKey') as string;

  if (!ALL_VALVES.includes(valveKey as any)) throw Err.badRequest('Invalid valve key');

  const device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(deviceId, u.id).first<any>();
  if (!device) throw Err.notFound('Device');

  // Premium relay must be activated first
  if (PREMIUM_RELAYS.includes(valveKey as any)) {
    await ensureTables(c.env.DB);
    const lic = await c.env.DB.prepare(
      `SELECT activated FROM relay_licenses WHERE device_id=?1 AND relay_key=?2`
    ).bind(deviceId, valveKey).first<any>();
    if (!lic?.activated) throw Err.forbidden(`${valveKey} is not activated on this device`);
  }

  const rule = ruleSchema.parse(await c.req.json());
  await ensureTables(c.env.DB);

  await c.env.DB.prepare(`
    INSERT INTO automation_rules
      (id, device_id, user_id, valve_key, enabled, mode,
       on_moisture_lt, on_temp_gt, on_logic,
       off_moisture_gt, off_temp_lt, off_logic,
       schedule_start, schedule_end, max_duration_s)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
    ON CONFLICT(device_id, valve_key) DO UPDATE SET
      enabled=excluded.enabled, mode=excluded.mode,
      on_moisture_lt=excluded.on_moisture_lt, on_temp_gt=excluded.on_temp_gt,
      on_logic=excluded.on_logic,
      off_moisture_gt=excluded.off_moisture_gt, off_temp_lt=excluded.off_temp_lt,
      off_logic=excluded.off_logic,
      schedule_start=excluded.schedule_start, schedule_end=excluded.schedule_end,
      max_duration_s=excluded.max_duration_s,
      updated_at=datetime('now')
  `).bind(
    newId(), deviceId, u.id, valveKey,
    rule.enabled ? 1 : 0, rule.mode,
    rule.on_moisture_lt, rule.on_temp_gt, rule.on_logic,
    rule.off_moisture_gt, rule.off_temp_lt, rule.off_logic,
    rule.schedule_start, rule.schedule_end, rule.max_duration_s,
  ).run();

  // Push updated config to device
  await enqueue(c.env, {
    userId: u.id, deviceId,
    command: { command_type: 'sync_automation', payload: { valve_key: valveKey, rule } },
    source: 'automation',
  }).catch(() => {}); // non-fatal if device offline

  const saved = await c.env.DB.prepare(
    `SELECT * FROM automation_rules WHERE device_id=?1 AND valve_key=?2`
  ).bind(deviceId, valveKey).first<any>();

  return c.json({ rule: saved }, 201);
});

/** DELETE /api/relays/:deviceId/automation/:valveKey */
app.delete('/:deviceId/automation/:valveKey', authUser, loadSubscription(), async (c) => {
  const u        = c.get('user')!;
  const deviceId = c.req.param('deviceId');
  const valveKey = c.req.param('valveKey');

  const device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(deviceId, u.id).first<any>();
  if (!device) throw Err.notFound('Device');

  await c.env.DB.prepare(
    `DELETE FROM automation_rules WHERE device_id=?1 AND valve_key=?2`
  ).bind(deviceId, valveKey).run();

  return c.json({ ok: true });
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

const activateSchema = z.object({
  relay_key:   z.enum(['relay6', 'relay7', 'relay8']),
  amount_paid: z.number().min(0).default(50),
  notes:       z.string().max(200).optional(),
});

/** POST /api/relays/:deviceId/activate (admin only) */
app.post('/:deviceId/activate', authAdmin, async (c) => {
  const admin    = c.get('admin')!;
  const deviceId = c.req.param('deviceId');
  const { relay_key, amount_paid, notes } = activateSchema.parse(await c.req.json());

  await ensureTables(c.env.DB);

  await c.env.DB.prepare(`
    INSERT INTO relay_licenses (id, device_id, user_id, relay_key, activated, activated_by, activated_at, amount_paid, notes)
    SELECT ?1, d.id, d.user_id, ?2, 1, ?3, datetime('now'), ?4, ?5 FROM devices d WHERE d.id=?6
    ON CONFLICT(device_id, relay_key) DO UPDATE SET
      activated=1, activated_by=excluded.activated_by,
      activated_at=excluded.activated_at, amount_paid=excluded.amount_paid,
      notes=excluded.notes, updated_at=datetime('now')
  `).bind(newId(), relay_key, admin.id, amount_paid, notes ?? null, deviceId).run();

  // Get device user_id for enqueue
  const device = await c.env.DB.prepare(
    `SELECT id, user_id FROM devices WHERE id=?1`
  ).bind(deviceId).first<any>();
  if (!device) throw Err.notFound('Device');

  // Push relay activation to device
  await enqueue(c.env, {
    userId: device.user_id, deviceId,
    command: { command_type: 'activate_relay', payload: { relay_key, activated: true } },
    source: 'admin',
  }).catch(() => {});

  return c.json({ ok: true, relay_key, activated: true });
});

/** POST /api/relays/:deviceId/deactivate (admin only) */
app.post('/:deviceId/deactivate', authAdmin, async (c) => {
  const deviceId = c.req.param('deviceId');
  const { relay_key } = z.object({ relay_key: z.enum(['relay6', 'relay7', 'relay8']) })
    .parse(await c.req.json());

  await ensureTables(c.env.DB);
  await c.env.DB.prepare(
    `UPDATE relay_licenses SET activated=0, updated_at=datetime('now')
      WHERE device_id=?1 AND relay_key=?2`
  ).bind(deviceId, relay_key).run();

  const device = await c.env.DB.prepare(
    `SELECT id, user_id FROM devices WHERE id=?1`
  ).bind(deviceId).first<any>();
  if (device) {
    await enqueue(c.env, {
      userId: device.user_id, deviceId,
      command: { command_type: 'activate_relay', payload: { relay_key, activated: false } },
      source: 'admin',
    }).catch(() => {});
  }

  return c.json({ ok: true, relay_key, activated: false });
});

/** GET /api/relays/:deviceId/push-config (admin) — push full config bundle */
app.get('/:deviceId/push-config', authAdmin, async (c) => {
  const deviceId = c.req.param('deviceId');

  const device = await c.env.DB.prepare(
    `SELECT id, user_id FROM devices WHERE id=?1`
  ).bind(deviceId).first<any>();
  if (!device) throw Err.notFound('Device');

  await ensureTables(c.env.DB);

  const { results: licenses }   = await c.env.DB.prepare(
    `SELECT relay_key, activated FROM relay_licenses WHERE device_id=?1`
  ).bind(deviceId).all<any>();

  const { results: rules } = await c.env.DB.prepare(
    `SELECT * FROM automation_rules WHERE device_id=?1 AND enabled=1`
  ).bind(deviceId).all<any>();

  const { results: zones } = await c.env.DB.prepare(
    `SELECT zone_key, zone_name FROM device_zones WHERE device_id=?1`
  ).bind(deviceId).all<any>().catch(() => ({ results: [] }));

  const payload = { licenses, rules, zones };

  await enqueue(c.env, {
    userId: device.user_id, deviceId,
    command: { command_type: 'push_config', payload },
    source: 'admin',
  });

  return c.json({ ok: true, payload });
});

export default app;
