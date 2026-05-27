import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { AppCtx } from '../lib/middleware';
import { authDevice } from '../lib/middleware';
import { Err } from '../lib/errors';
import { signJWT } from '../lib/jwt';
import { audit } from '../lib/audit';
import { fetchNext, ack } from '../services/command';
import { getLatest, isActive } from '../services/subscription';

const app = new Hono<AppCtx>();

const authSchema = z.object({
  device_uid: z.string().min(4),
  device_secret: z.string().min(8),
  firmware_version: z.string().max(40).optional(),
});

app.post('/auth', async (c) => {
  const body = authSchema.parse(await c.req.json());
  const device = await c.env.DB.prepare(`SELECT * FROM devices WHERE device_uid=?1`)
    .bind(body.device_uid).first<any>();
  if (!device) throw Err.unauthorized('Unknown device');
  if (!device.enabled) throw Err.forbidden('Device disabled');
  const ok = await bcrypt.compare(body.device_secret, device.device_secret_hash);
  if (!ok) throw Err.unauthorized('Bad secret');

  await c.env.DB.prepare(
    `UPDATE devices SET firmware_version=COALESCE(?2, firmware_version),
                        last_seen_at=datetime('now'),
                        status='online',
                        updated_at=datetime('now')
      WHERE id=?1`
  ).bind(device.id, body.firmware_version ?? null).run();
  await audit(c.env, { actorType: 'device', actorId: device.id, action: 'device.auth' });

  const token = await signJWT({ sub: device.id, uid: device.device_uid },
                               c.env.DEVICE_JWT_SECRET,
                               c.env.DEVICE_JWT_EXPIRES_IN || '30d', 'device');
  return c.json({
    token,
    device: { id: device.id, device_uid: device.device_uid, plan_bound: device.plan_bound },
  });
});

const hbSchema = z.object({
  relay1_state:   z.boolean().optional(),
  valve1_state:   z.boolean().optional(),
  valve2_state:   z.boolean().optional(),
  valve3_state:   z.boolean().optional(),
  moisture_value: z.number().int().optional(),
  wifi_rssi:      z.number().int().optional(),
  ip:             z.string().max(64).optional(),
  uptime_ms:      z.number().int().optional(),
}).passthrough();

app.post('/heartbeat', authDevice, async (c) => {
  const d = c.get('device')!;
  const body = hbSchema.parse(await c.req.json());

  await c.env.DB.prepare(
    `UPDATE devices
        SET last_seen_at=datetime('now'),
            status='online',
            last_known_ip=COALESCE(?2, last_known_ip),
            updated_at=datetime('now')
      WHERE id=?1`
  ).bind(d.id, body.ip ?? null).run();

  await c.env.DB.prepare(
    `INSERT INTO device_status_logs
       (device_id, relay1_state, valve1_state, valve2_state, valve3_state,
        moisture_value, wifi_rssi, raw_payload)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(
    d.id,
    body.relay1_state == null ? null : (body.relay1_state ? 1 : 0),
    body.valve1_state == null ? null : (body.valve1_state ? 1 : 0),
    body.valve2_state == null ? null : (body.valve2_state ? 1 : 0),
    body.valve3_state == null ? null : (body.valve3_state ? 1 : 0),
    body.moisture_value ?? null,
    body.wifi_rssi ?? null,
    JSON.stringify(body),
  ).run();

  const owner = await c.env.DB.prepare(
    `SELECT user_id, plan_bound FROM devices WHERE id=?1`
  ).bind(d.id).first<any>();
  const sub = owner?.user_id ? await getLatest(c.env, owner.user_id) : null;
  const active = isActive(sub);

  return c.json({
    ok: true,
    subscription_active: active,
    plan_bound: owner?.plan_bound,
    server_time: new Date().toISOString(),
  });
});

app.get('/next', authDevice, async (c) => {
  const d = c.get('device')!;
  const owner = await c.env.DB.prepare(
    `SELECT user_id FROM devices WHERE id=?1`
  ).bind(d.id).first<any>();
  const sub = owner?.user_id ? await getLatest(c.env, owner.user_id) : null;
  if (!isActive(sub)) return c.json({ command: null, subscription_active: false });

  const cmd = await fetchNext(c.env, d.id);
  return c.json({ command: cmd, subscription_active: true });
});

const ackSchema = z.object({
  status: z.enum(['executed', 'failed']),
  error: z.string().max(500).optional(),
});

app.post('/ack/:cmdId', authDevice, async (c) => {
  const d = c.get('device')!;
  const body = ackSchema.parse(await c.req.json());
  const command = await ack(c.env, d.id, c.req.param('cmdId'), {
    status: body.status, error: body.error ?? null,
  });
  if (!command) throw Err.notFound('Command');
  return c.json({ command });
});

// ── Sensor data ingest (device → cloud) ──────────────────────────────────────
const sensorSchema = z.object({
  sensor_addr:  z.number().int().min(1).max(247).default(1),
  moisture_pct: z.number().min(0).max(100).nullable().default(null),
  temp_c:       z.number().min(-40).max(80).nullable().default(null),
  raw_moisture: z.number().int().nullable().default(null),
  raw_temp:     z.number().int().nullable().default(null),
  read_ok:      z.boolean().default(true),
});

/**
 * POST /api/device/sensor — device posts sensor reading
 * Device should call this every ~30s when sensor is connected.
 */
app.post('/sensor', authDevice, async (c) => {
  const d    = c.get('device')!;
  const body = sensorSchema.parse(await c.req.json());
  const { newId } = await import('../lib/ids');

  // Ensure table exists
  await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS sensor_readings (
    id TEXT PRIMARY KEY, device_id TEXT NOT NULL,
    sensor_addr INTEGER NOT NULL DEFAULT 1,
    moisture_pct REAL, temp_c REAL, raw_moisture INTEGER, raw_temp INTEGER,
    read_ok INTEGER NOT NULL DEFAULT 1,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')))`).run();

  await c.env.DB.prepare(
    `INSERT INTO sensor_readings (id, device_id, sensor_addr, moisture_pct, temp_c, raw_moisture, raw_temp, read_ok)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`
  ).bind(
    newId(), d.id, body.sensor_addr,
    body.moisture_pct, body.temp_c,
    body.raw_moisture, body.raw_temp,
    body.read_ok ? 1 : 0,
  ).run();

  // Check automation rules and generate alerts if thresholds breached
  if (body.read_ok && (body.moisture_pct !== null || body.temp_c !== null)) {
    const { results: rules } = await c.env.DB.prepare(
      `SELECT * FROM automation_rules WHERE device_id=?1 AND enabled=1 AND mode='auto'`
    ).bind(d.id).all<any>().catch(() => ({ results: [] as any[] }));

    const owner = await c.env.DB.prepare(
      `SELECT user_id FROM devices WHERE id=?1`
    ).bind(d.id).first<any>();

    for (const rule of rules as any[]) {
      // Generate sensor_offline alert if read_ok=false
      if (!body.read_ok) {
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO sensor_alerts (id, device_id, user_id, alert_type, valve_key)
           VALUES (?1,?2,?3,'sensor_offline',?4)`
        ).bind(newId(), d.id, owner?.user_id, rule.valve_key).run().catch(() => {});
        continue;
      }

      // Moisture low alert
      if (rule.on_moisture_lt !== null && body.moisture_pct !== null
          && body.moisture_pct < rule.on_moisture_lt) {
        await c.env.DB.prepare(
          `INSERT INTO sensor_alerts (id, device_id, user_id, alert_type, valve_key, threshold, actual_value)
           VALUES (?1,?2,?3,'moisture_low',?4,?5,?6)`
        ).bind(newId(), d.id, owner?.user_id, rule.valve_key, rule.on_moisture_lt, body.moisture_pct)
          .run().catch(() => {});
      }

      // High temp alert
      if (rule.on_temp_gt !== null && body.temp_c !== null
          && body.temp_c > rule.on_temp_gt + 5) {
        await c.env.DB.prepare(
          `INSERT INTO sensor_alerts (id, device_id, user_id, alert_type, valve_key, threshold, actual_value)
           VALUES (?1,?2,?3,'temp_high',?4,?5,?6)`
        ).bind(newId(), d.id, owner?.user_id, rule.valve_key, rule.on_temp_gt, body.temp_c)
          .run().catch(() => {});
      }
    }
  }

  return c.json({ ok: true, recorded_at: new Date().toISOString() });
});

/**
 * GET /api/device/config — device fetches its full config on boot
 * Returns relay licenses, automation rules, zone names
 */
app.get('/config', authDevice, async (c) => {
  const d = c.get('device')!;

  const [licResult, ruleResult, zoneResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT relay_key, activated FROM relay_licenses WHERE device_id=?1`
    ).bind(d.id).all<any>().catch(() => ({ results: [] })),
    c.env.DB.prepare(
      `SELECT valve_key, enabled, mode, on_moisture_lt, on_temp_gt, on_logic,
              off_moisture_gt, off_temp_lt, off_logic,
              schedule_start, schedule_end, max_duration_s
         FROM automation_rules WHERE device_id=?1`
    ).bind(d.id).all<any>().catch(() => ({ results: [] })),
    c.env.DB.prepare(
      `SELECT zone_key, zone_name FROM device_zones WHERE device_id=?1`
    ).bind(d.id).all<any>().catch(() => ({ results: [] })),
  ]);

  return c.json({
    relay_licenses: (licResult as any).results,
    automation_rules: (ruleResult as any).results,
    zone_names: (zoneResult as any).results,
    server_time: new Date().toISOString(),
  });
});

export default app;
