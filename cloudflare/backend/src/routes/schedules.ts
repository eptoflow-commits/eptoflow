import { Hono } from 'hono';
import { z } from 'zod';
import type { AppCtx } from '../lib/middleware';
import { authUser, loadSubscription } from '../lib/middleware';
import { Err } from '../lib/errors';
import { newId } from '../lib/ids';
import { planAllows, type PlanName } from '../services/plan';

const app = new Hono<AppCtx>();
app.use('*', authUser, loadSubscription({ requireActive: true }));

const scheduleSchema = z.object({
  device_id: z.string().min(1),
  zone_or_output: z.enum(['valve1', 'valve2', 'valve3', 'relay1']),
  days_of_week: z.array(z.number().int().min(1).max(7)).min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  duration_seconds: z.number().int().min(1).max(3600),
  enabled: z.boolean().default(true),
});

function rowToSchedule(row: any) {
  if (!row) return row;
  const out = { ...row };
  if (typeof out.days_of_week === 'string') {
    out.days_of_week = out.days_of_week
      .split(',')
      .map((n: string) => parseInt(n, 10))
      .filter((n: number) => Number.isFinite(n));
  }
  out.enabled = !!out.enabled;
  return out;
}

app.get('/', async (c) => {
  const u = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT s.*
       FROM schedules s
       JOIN devices d ON d.id = s.device_id
      WHERE s.user_id=?1 AND d.user_id=?1
      ORDER BY s.created_at DESC`
  ).bind(u.id).all<any>();
  return c.json({ schedules: results.map(rowToSchedule) });
});

app.post('/', async (c) => {
  const u = c.get('user')!;
  const body = scheduleSchema.parse(await c.req.json());

  const device = await c.env.DB.prepare(
    `SELECT id, plan_bound FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(body.device_id, u.id).first<any>();
  if (!device) throw Err.notFound('Device');
  if (!planAllows(device.plan_bound as PlanName, body.zone_or_output)) {
    throw Err.planRestricted(`${body.zone_or_output} not available on ${device.plan_bound} plan`);
  }

  const id = newId();
  const dowCsv = body.days_of_week.join(',');
  await c.env.DB.prepare(
    `INSERT INTO schedules
       (id, user_id, device_id, zone_or_output, days_of_week, start_time,
        duration_seconds, enabled)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(
    id, u.id, body.device_id, body.zone_or_output, dowCsv,
    body.start_time, body.duration_seconds, body.enabled ? 1 : 0,
  ).run();
  const row = await c.env.DB.prepare(`SELECT * FROM schedules WHERE id=?1`)
    .bind(id).first<any>();
  return c.json({ schedule: rowToSchedule(row) }, 201);
});

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  days_of_week: z.array(z.number().int().min(1).max(7)).min(1).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  duration_seconds: z.number().int().min(1).max(3600).optional(),
});

app.patch('/:id', async (c) => {
  const u = c.get('user')!;
  const body = patchSchema.parse(await c.req.json());
  const sets: string[] = [];
  const values: any[] = [];
  let i = 2;
  if ('enabled' in body && body.enabled !== undefined) {
    sets.push(`enabled=?${i++}`); values.push(body.enabled ? 1 : 0);
  }
  if ('days_of_week' in body && body.days_of_week) {
    sets.push(`days_of_week=?${i++}`); values.push(body.days_of_week.join(','));
  }
  if ('start_time' in body && body.start_time) {
    sets.push(`start_time=?${i++}`); values.push(body.start_time);
  }
  if ('duration_seconds' in body && body.duration_seconds !== undefined) {
    sets.push(`duration_seconds=?${i++}`); values.push(body.duration_seconds);
  }
  if (!sets.length) throw Err.badRequest('No fields to update');
  sets.push(`updated_at=datetime('now')`);

  const res = await c.env.DB.prepare(
    `UPDATE schedules SET ${sets.join(', ')}
      WHERE id=?1 AND user_id=?${i}`
  ).bind(c.req.param('id'), ...values, u.id).run();
  if (!res.meta.changes) throw Err.notFound('Schedule');

  const row = await c.env.DB.prepare(`SELECT * FROM schedules WHERE id=?1`)
    .bind(c.req.param('id')).first<any>();
  return c.json({ schedule: rowToSchedule(row) });
});

app.delete('/:id', async (c) => {
  const u = c.get('user')!;
  const res = await c.env.DB.prepare(
    `DELETE FROM schedules WHERE id=?1 AND user_id=?2`
  ).bind(c.req.param('id'), u.id).run();
  if (!res.meta.changes) throw Err.notFound('Schedule');
  return c.json({ ok: true });
});

export default app;
