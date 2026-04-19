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

export default app;
