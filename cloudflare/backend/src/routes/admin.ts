import { Hono } from 'hono';
import { z } from 'zod';
import type { AppCtx } from '../lib/middleware';
import { authAdmin } from '../lib/middleware';
import { Err } from '../lib/errors';
import { newId } from '../lib/ids';
import { audit } from '../lib/audit';
import { activateOrRenew } from '../services/subscription';
import type { PlanName } from '../services/plan';

const app = new Hono<AppCtx>();
app.use('*', authAdmin);

// ---------- Dashboard -------------------------------------------------------
app.get('/dashboard', async (c) => {
  const nowIso = new Date().toISOString();
  const stmts = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) AS c FROM users`),
    c.env.DB.prepare(`SELECT COUNT(*) AS c FROM subscriptions WHERE status='active' AND end_date>?1`).bind(nowIso),
    c.env.DB.prepare(`SELECT COUNT(*) AS c FROM subscriptions WHERE status='expired' OR (status='active' AND end_date<=?1)`).bind(nowIso),
    c.env.DB.prepare(`SELECT COUNT(*) AS c FROM payments WHERE verification_status='pending'`),
    c.env.DB.prepare(`SELECT COUNT(*) AS c FROM devices WHERE status='online'`),
    c.env.DB.prepare(`SELECT COUNT(*) AS c FROM devices WHERE status<>'online'`),
  ]);
  const num = (r: any) => Number(r?.results?.[0]?.c || 0);
  return c.json({
    totals: {
      users:                 num(stmts[0]),
      active_subscriptions:  num(stmts[1]),
      expired_subscriptions: num(stmts[2]),
      pending_payments:      num(stmts[3]),
      online_devices:        num(stmts[4]),
      offline_devices:       num(stmts[5]),
    },
  });
});

// ---------- Users -----------------------------------------------------------
app.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at,
            (SELECT plan_name FROM subscriptions WHERE user_id=u.id
              ORDER BY end_date DESC LIMIT 1) AS plan_name,
            (SELECT status    FROM subscriptions WHERE user_id=u.id
              ORDER BY end_date DESC LIMIT 1) AS sub_status,
            (SELECT end_date  FROM subscriptions WHERE user_id=u.id
              ORDER BY end_date DESC LIMIT 1) AS end_date
       FROM users u
      ORDER BY u.created_at DESC`
  ).all<any>();
  return c.json({ users: results });
});

app.post('/users/:id/status', async (c) => {
  const admin = c.get('admin')!;
  const body = await c.req.json().catch(() => ({}));
  const status = body?.status;
  if (!['active', 'suspended'].includes(status)) {
    throw Err.badRequest('status must be active|suspended');
  }
  const res = await c.env.DB.prepare(
    `UPDATE users SET status=?2, updated_at=datetime('now') WHERE id=?1`
  ).bind(c.req.param('id'), status).run();
  if (!res.meta.changes) throw Err.notFound('User');
  await audit(c.env, {
    actorType: 'admin', actorId: admin.id, action: `user.${status}`,
    entityType: 'user', entityId: c.req.param('id'),
  });
  return c.json({ ok: true });
});

// ---------- Devices ---------------------------------------------------------
app.get('/devices', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT d.*, u.email AS user_email FROM devices d
       LEFT JOIN users u ON u.id=d.user_id
      ORDER BY d.created_at DESC`
  ).all<any>();
  return c.json({
    devices: results.map((d: any) => ({ ...d, enabled: !!d.enabled })),
  });
});

app.post('/devices/:id/enabled', async (c) => {
  const admin = c.get('admin')!;
  const body = await c.req.json().catch(() => ({}));
  const enabled = !!body?.enabled;
  const res = await c.env.DB.prepare(
    `UPDATE devices SET enabled=?2, updated_at=datetime('now') WHERE id=?1`
  ).bind(c.req.param('id'), enabled ? 1 : 0).run();
  if (!res.meta.changes) throw Err.notFound('Device');
  await audit(c.env, {
    actorType: 'admin', actorId: admin.id,
    action: `device.${enabled ? 'enable' : 'disable'}`,
    entityType: 'device', entityId: c.req.param('id'),
  });
  return c.json({ ok: true });
});

app.post('/devices/:id/assign', async (c) => {
  const admin = c.get('admin')!;
  const body = await c.req.json().catch(() => ({}));
  const userId = body?.user_id || null;
  const res = await c.env.DB.prepare(
    `UPDATE devices SET user_id=?2, updated_at=datetime('now') WHERE id=?1`
  ).bind(c.req.param('id'), userId).run();
  if (!res.meta.changes) throw Err.notFound('Device');
  await audit(c.env, {
    actorType: 'admin', actorId: admin.id, action: 'device.assign',
    entityType: 'device', entityId: c.req.param('id'),
    metadata: { user_id: userId },
  });
  return c.json({ ok: true });
});

// ---------- Subscriptions ---------------------------------------------------
app.get('/subscriptions', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, u.email FROM subscriptions s
       JOIN users u ON u.id=s.user_id
      ORDER BY s.created_at DESC LIMIT 500`
  ).all<any>();
  return c.json({ subscriptions: results });
});

const renewSchema = z.object({
  user_id: z.string().min(1),
  plan: z.enum(['basic', 'premium']),
  subscription_id: z.string().optional(),
  payment_reference: z.string().max(200).optional(),
});

app.post('/subscriptions/renew', async (c) => {
  const admin = c.get('admin')!;
  const body = renewSchema.parse(await c.req.json());
  const sub = await activateOrRenew(c.env, {
    subscriptionId: body.subscription_id ?? null,
    adminId: admin.id,
    userId: body.user_id,
    planName: body.plan as PlanName,
    paymentReference: body.payment_reference ?? null,
  });
  await c.env.DB.prepare(
    `INSERT INTO notifications (id, user_id, title, message, type)
     VALUES (?1, ?2, 'Subscription activated',
             'Your ' || ?3 || ' plan is now active for 30 days.',
             'billing')`
  ).bind(newId(), body.user_id, body.plan).run();
  return c.json({ subscription: sub });
});

// ---------- Payments --------------------------------------------------------
app.get('/payments', async (c) => {
  const status = c.req.query('status');
  const rows = status
    ? await c.env.DB.prepare(
        `SELECT p.*, u.email, u.full_name FROM payments p
           JOIN users u ON u.id=p.user_id
          WHERE p.verification_status=?1
          ORDER BY p.created_at DESC LIMIT 500`
      ).bind(status).all<any>()
    : await c.env.DB.prepare(
        `SELECT p.*, u.email, u.full_name FROM payments p
           JOIN users u ON u.id=p.user_id
          ORDER BY p.created_at DESC LIMIT 500`
      ).all<any>();
  return c.json({ payments: rows.results });
});

const verifySchema = z.object({
  decision: z.enum(['verified', 'rejected']),
  note: z.string().max(500).optional(),
});

app.post('/payments/:id/verify', async (c) => {
  const admin = c.get('admin')!;
  const body = verifySchema.parse(await c.req.json());
  const paymentId = c.req.param('id');

  const existing = await c.env.DB.prepare(`SELECT * FROM payments WHERE id=?1`)
    .bind(paymentId).first<any>();
  if (!existing) throw Err.notFound('Payment');

  await c.env.DB.prepare(
    `UPDATE payments
        SET verification_status=?2,
            verified_by_admin=?3,
            verified_at=datetime('now')
      WHERE id=?1`
  ).bind(paymentId, body.decision, admin.id).run();

  let subscription: any = null;
  if (body.decision === 'verified') {
    const subRow = await c.env.DB.prepare(
      `SELECT plan_name FROM subscriptions WHERE id=?1`
    ).bind(existing.subscription_id).first<any>();
    subscription = await activateOrRenew(c.env, {
      subscriptionId: existing.subscription_id,
      adminId: admin.id,
      userId: existing.user_id,
      planName: (subRow?.plan_name || 'basic') as PlanName,
      paymentReference: existing.payment_reference,
    });
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type)
       VALUES (?1, ?2, 'Payment verified',
               'Your payment has been verified. Your subscription is active.',
               'billing')`
    ).bind(newId(), existing.user_id).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type)
       VALUES (?1, ?2, 'Payment rejected',
               COALESCE(?3, 'Your payment could not be verified. Please contact support.'),
               'billing')`
    ).bind(newId(), existing.user_id, body.note ?? null).run();
  }

  await audit(c.env, {
    actorType: 'admin', actorId: admin.id, action: `payment.${body.decision}`,
    entityType: 'payment', entityId: paymentId, metadata: { note: body.note },
  });

  const payment = await c.env.DB.prepare(`SELECT * FROM payments WHERE id=?1`)
    .bind(paymentId).first<any>();
  return c.json({ payment, subscription });
});

// ---------- Audit + schedules ----------------------------------------------
app.get('/audit-logs', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`
  ).all<any>();
  return c.json({ audit_logs: results });
});

app.get('/schedules', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.*, u.email, d.device_uid
       FROM schedules s
       JOIN users u   ON u.id=s.user_id
       JOIN devices d ON d.id=s.device_id
      ORDER BY s.created_at DESC LIMIT 500`
  ).all<any>();
  return c.json({
    schedules: results.map((s: any) => ({
      ...s,
      enabled: !!s.enabled,
      days_of_week: typeof s.days_of_week === 'string'
        ? s.days_of_week.split(',').map((n: string) => parseInt(n, 10))
          .filter((n: number) => Number.isFinite(n))
        : s.days_of_week,
    })),
  });
});

export default app;
