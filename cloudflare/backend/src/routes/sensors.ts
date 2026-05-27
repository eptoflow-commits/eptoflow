/**
 * Sensor data ingest & history — /api/sensors
 *
 * Device POSTs readings every N seconds via POST /api/device/sensor (device-auth).
 * Users query history via GET /api/sensors/:deviceId (user-auth).
 *
 * Routes:
 *   GET /api/sensors/:deviceId          — latest reading + recent history
 *   GET /api/sensors/:deviceId/history  — paginated history (last 24h default)
 *   GET /api/sensors/:deviceId/alerts   — unresolved alerts
 *   POST /api/sensors/:deviceId/alerts/:id/resolve
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppCtx } from '../lib/middleware';
import { authUser, loadSubscription } from '../lib/middleware';
import { Err } from '../lib/errors';
import { newId } from '../lib/ids';

const app = new Hono<AppCtx>();
app.use('*', authUser, loadSubscription());

async function ensureTables(db: any) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS sensor_readings (
    id TEXT PRIMARY KEY, device_id TEXT NOT NULL,
    sensor_addr INTEGER NOT NULL DEFAULT 1,
    moisture_pct REAL, temp_c REAL, raw_moisture INTEGER, raw_temp INTEGER,
    read_ok INTEGER NOT NULL DEFAULT 1,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')))`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS sensor_alerts (
    id TEXT PRIMARY KEY, device_id TEXT NOT NULL, user_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, valve_key TEXT, threshold REAL, actual_value REAL,
    resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT)`).run();
}

/** GET /api/sensors/:deviceId — latest reading + 24h sparkline */
app.get('/:deviceId', async (c) => {
  const u        = c.get('user')!;
  const deviceId = c.req.param('deviceId');

  const device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(deviceId, u.id).first<any>();
  if (!device) throw Err.notFound('Device');

  await ensureTables(c.env.DB);

  const latest = await c.env.DB.prepare(
    `SELECT * FROM sensor_readings WHERE device_id=?1 ORDER BY recorded_at DESC LIMIT 1`
  ).bind(deviceId).first<any>();

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { results: sparkline } = await c.env.DB.prepare(
    `SELECT moisture_pct, temp_c, recorded_at FROM sensor_readings
      WHERE device_id=?1 AND recorded_at > ?2 AND read_ok=1
      ORDER BY recorded_at ASC LIMIT 288` // every 5 min for 24h
  ).bind(deviceId, since).all<any>();

  return c.json({ latest: latest ?? null, sparkline });
});

/** GET /api/sensors/:deviceId/history?hours=24&limit=500 */
app.get('/:deviceId/history', async (c) => {
  const u        = c.get('user')!;
  const deviceId = c.req.param('deviceId');

  const device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(deviceId, u.id).first<any>();
  if (!device) throw Err.notFound('Device');

  const hours = Math.min(parseInt(c.req.query('hours') ?? '24', 10), 168); // max 7 days
  const limit = Math.min(parseInt(c.req.query('limit') ?? '500', 10), 2000);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  await ensureTables(c.env.DB);

  const { results } = await c.env.DB.prepare(
    `SELECT moisture_pct, temp_c, read_ok, recorded_at
      FROM sensor_readings WHERE device_id=?1 AND recorded_at > ?2
      ORDER BY recorded_at DESC LIMIT ?3`
  ).bind(deviceId, since, limit).all<any>();

  return c.json({ readings: results.reverse(), hours, count: results.length });
});

/** GET /api/sensors/:deviceId/alerts */
app.get('/:deviceId/alerts', async (c) => {
  const u        = c.get('user')!;
  const deviceId = c.req.param('deviceId');

  const device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(deviceId, u.id).first<any>();
  if (!device) throw Err.notFound('Device');

  await ensureTables(c.env.DB);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM sensor_alerts WHERE device_id=?1 AND resolved=0
      ORDER BY created_at DESC LIMIT 50`
  ).bind(deviceId).all<any>();

  return c.json({ alerts: results });
});

/** POST /api/sensors/:deviceId/alerts/:alertId/resolve */
app.post('/:deviceId/alerts/:alertId/resolve', async (c) => {
  const u        = c.get('user')!;
  const deviceId = c.req.param('deviceId');
  const alertId  = c.req.param('alertId');

  const device = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(deviceId, u.id).first<any>();
  if (!device) throw Err.notFound('Device');

  await ensureTables(c.env.DB);
  await c.env.DB.prepare(
    `UPDATE sensor_alerts SET resolved=1, resolved_at=datetime('now')
      WHERE id=?1 AND device_id=?2`
  ).bind(alertId, deviceId).run();

  return c.json({ ok: true });
});

export default app;
