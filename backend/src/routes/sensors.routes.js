/**
 * Sensor data — /api/sensors  (Express mirror of CF sensors.ts)
 *
 * Routes (user-auth, active subscription):
 *   GET  /:deviceId           — latest reading + 24h sparkline
 *   GET  /:deviceId/history   — paginated history (up to 7 days)
 *   GET  /:deviceId/alerts    — unresolved sensor alerts
 *   POST /:deviceId/alerts/:alertId/resolve
 */

import { Router }  from 'express';
import { query }   from '../db/pool.js';
import { authUser, loadSubscription } from '../middleware/auth.js';
import { asyncH, Errors } from '../utils/http.js';

const router = Router();
router.use(authUser, loadSubscription());

async function ensureTables() {
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

  await query(`
    CREATE TABLE IF NOT EXISTS sensor_alerts (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id    UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      user_id      UUID NOT NULL REFERENCES users(id),
      alert_type   VARCHAR(40) NOT NULL,
      valve_key    VARCHAR(20),
      threshold    NUMERIC(8,2),
      actual_value NUMERIC(8,2),
      resolved     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at  TIMESTAMPTZ
    )
  `).catch(() => {});
}

async function ownDevice(deviceId, userId) {
  const { rows } = await query(
    `SELECT id FROM devices WHERE id=$1 AND user_id=$2`, [deviceId, userId]
  );
  if (!rows[0]) throw Errors.notFound('Device');
  return rows[0];
}

// ─── GET /:deviceId — latest + 24h sparkline ──────────────────────────────────

router.get('/:deviceId', asyncH(async (req, res) => {
  await ownDevice(req.params.deviceId, req.user.id);
  await ensureTables();

  const { rows: [latest] } = await query(
    `SELECT * FROM sensor_readings WHERE device_id=$1 ORDER BY recorded_at DESC LIMIT 1`,
    [req.params.deviceId]
  );

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { rows: sparkline } = await query(
    `SELECT moisture_pct, temp_c, recorded_at FROM sensor_readings
      WHERE device_id=$1 AND recorded_at > $2 AND read_ok=TRUE
      ORDER BY recorded_at ASC LIMIT 288`,
    [req.params.deviceId, since]
  );

  res.json({ latest: latest ?? null, sparkline });
}));

// ─── GET /:deviceId/history ───────────────────────────────────────────────────

router.get('/:deviceId/history', asyncH(async (req, res) => {
  await ownDevice(req.params.deviceId, req.user.id);
  await ensureTables();

  const hours = Math.min(parseInt(req.query.hours ?? '24', 10), 168);
  const limit = Math.min(parseInt(req.query.limit ?? '500', 10), 2000);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { rows } = await query(
    `SELECT moisture_pct, temp_c, read_ok, recorded_at
       FROM sensor_readings WHERE device_id=$1 AND recorded_at > $2
       ORDER BY recorded_at DESC LIMIT $3`,
    [req.params.deviceId, since, limit]
  );

  res.json({ readings: rows.reverse(), hours, count: rows.length });
}));

// ─── GET /:deviceId/alerts ────────────────────────────────────────────────────

router.get('/:deviceId/alerts', asyncH(async (req, res) => {
  await ownDevice(req.params.deviceId, req.user.id);
  await ensureTables();

  const { rows } = await query(
    `SELECT * FROM sensor_alerts WHERE device_id=$1 AND resolved=FALSE
      ORDER BY created_at DESC LIMIT 50`,
    [req.params.deviceId]
  );

  res.json({ alerts: rows });
}));

// ─── POST /:deviceId/alerts/:alertId/resolve ──────────────────────────────────

router.post('/:deviceId/alerts/:alertId/resolve', asyncH(async (req, res) => {
  await ownDevice(req.params.deviceId, req.user.id);
  await ensureTables();

  await query(
    `UPDATE sensor_alerts SET resolved=TRUE, resolved_at=NOW()
      WHERE id=$1 AND device_id=$2`,
    [req.params.alertId, req.params.deviceId]
  );

  res.json({ ok: true });
}));

export default router;
