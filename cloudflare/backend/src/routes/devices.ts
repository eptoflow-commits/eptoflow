import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { AppCtx } from '../lib/middleware';
import { authUser, loadSubscription } from '../lib/middleware';
import { Err } from '../lib/errors';
import { newId, newDeviceUid, randomSecret } from '../lib/ids';
import { audit } from '../lib/audit';
import { serializePlan, type PlanName } from '../services/plan';
import { enqueue } from '../services/command';

const app = new Hono<AppCtx>();
app.use('*', authUser, loadSubscription());

app.get('/', async (c) => {
  const u = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT id, device_uid, device_name, plan_bound, status, last_seen_at,
            enabled, firmware_version
       FROM devices WHERE user_id=?1 ORDER BY created_at DESC`
  ).bind(u.id).all();
  return c.json({ devices: results });
});

app.post('/', async (c) => {
  const u = c.get('user')!;
  const sub = c.get('subscription');
  if (!sub?.isActive) throw Err.subscriptionInactive();
  const body = await c.req.json().catch(() => ({}));
  const name = (body?.device_name as string) || 'Eptoflow Device';
  const id = newId();
  const uid = newDeviceUid();
  const secret = randomSecret(24);
  const hash = await bcrypt.hash(secret, 10);
  const plan: PlanName = sub.plan_name;
  await c.env.DB.prepare(
    `INSERT INTO devices (id, user_id, device_uid, device_name, device_secret_hash, plan_bound)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(id, u.id, uid, name, hash, plan).run();
  const device = await c.env.DB.prepare(
    `SELECT id, device_uid, device_name, plan_bound, status, enabled, created_at
       FROM devices WHERE id=?1`
  ).bind(id).first();
  await audit(c.env, {
    actorType: 'user', actorId: u.id, action: 'device.provision',
    entityType: 'device', entityId: id, metadata: { uid },
  });
  return c.json({
    device,
    provisioning: { device_uid: uid, device_secret: secret },
    plan: serializePlan(plan),
  }, 201);
});

app.get('/:id', async (c) => {
  const u = c.get('user')!;
  const device = await c.env.DB.prepare(
    `SELECT * FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(c.req.param('id'), u.id).first<any>();
  if (!device) throw Err.notFound('Device');
  const lastStatus = await c.env.DB.prepare(
    `SELECT * FROM device_status_logs WHERE device_id=?1
      ORDER BY heartbeat_at DESC LIMIT 1`
  ).bind(device.id).first<any>();
  const { results: cmds } = await c.env.DB.prepare(
    `SELECT id, command_type, payload, status, source, created_at, executed_at
       FROM commands WHERE device_id=?1 ORDER BY created_at DESC LIMIT 20`
  ).bind(device.id).all<any>();
  for (const cmd of cmds) {
    if (typeof cmd.payload === 'string') {
      try { cmd.payload = JSON.parse(cmd.payload); } catch {}
    }
  }
  return c.json({
    device: {
      id: device.id,
      device_uid: device.device_uid,
      device_name: device.device_name,
      plan_bound: device.plan_bound,
      status: device.status,
      last_seen_at: device.last_seen_at,
      enabled: !!device.enabled,
      firmware_version: device.firmware_version,
    },
    last_status: lastStatus ?? null,
    recent_commands: cmds,
    plan: serializePlan(device.plan_bound as PlanName),
  });
});

const cmdSchema = z.object({
  command_type: z.string().min(1),
  payload: z.record(z.any()).default({}),
  source: z.enum(['manual', 'voice', 'schedule', 'automation']).default('manual'),
});

app.post('/:id/commands', async (c) => {
  const u = c.get('user')!;
  const body = cmdSchema.parse(await c.req.json());
  const device = await c.env.DB.prepare(
    `SELECT id, enabled FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(c.req.param('id'), u.id).first<any>();
  if (!device) throw Err.notFound('Device');
  if (!device.enabled) throw Err.forbidden('Device disabled by admin');
  const command = await enqueue(c.env, {
    userId: u.id, deviceId: device.id,
    command: { command_type: body.command_type, payload: body.payload },
    source: body.source,
  });
  if (command && typeof command.payload === 'string') {
    try { command.payload = JSON.parse(command.payload); } catch {}
  }
  return c.json({ command }, 202);
});

app.delete('/:id', async (c) => {
  const u = c.get('user')!;
  const res = await c.env.DB.prepare(
    `DELETE FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(c.req.param('id'), u.id).run();
  if (!res.meta.changes) throw Err.notFound('Device');
  return c.json({ ok: true });
});

export default app;
