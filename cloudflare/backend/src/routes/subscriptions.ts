import { Hono } from 'hono';
import { z } from 'zod';
import type { AppCtx } from '../lib/middleware';
import { authUser, loadSubscription } from '../lib/middleware';
import { cfg } from '../env';
import { newId } from '../lib/ids';
import { audit } from '../lib/audit';
import { serializePlan, type PlanName } from '../services/plan';
import { createPending } from '../services/subscription';

const app = new Hono<AppCtx>();
app.use('*', authUser, loadSubscription());

app.get('/me', async (c) => {
  const sub = c.get('subscription');
  const conf = cfg(c.env);
  return c.json({
    subscription: sub?.plan_name ? sub : null,
    plan: sub?.plan_name ? serializePlan(sub.plan_name as PlanName) : null,
    plans_catalog: {
      basic:   { ...conf.plans.basic,   ...serializePlan('basic')   },
      premium: { ...conf.plans.premium, ...serializePlan('premium') },
    },
  });
});

const payIntentSchema = z.object({
  plan: z.enum(['basic', 'premium']),
  payment_reference: z.string().max(200).optional(),
  screenshot_url_or_note: z.string().max(4000).optional(),
});

app.post('/payment-intent', async (c) => {
  const u = c.get('user')!;
  const body = payIntentSchema.parse(await c.req.json());
  const conf = cfg(c.env);
  const info = conf.plans[body.plan];

  const subscription = await createPending(c.env, u.id, body.plan);
  const paymentId = newId();
  await c.env.DB.prepare(
    `INSERT INTO payments
       (id, user_id, subscription_id, amount, payment_mode,
        payment_reference, screenshot_url_or_note)
     VALUES (?1, ?2, ?3, ?4, 'manual', ?5, ?6)`
  ).bind(
    paymentId, u.id, subscription!.id, info.amount,
    body.payment_reference ?? null,
    body.screenshot_url_or_note ?? null,
  ).run();
  const payment = await c.env.DB.prepare(`SELECT * FROM payments WHERE id=?1`)
    .bind(paymentId).first<any>();

  await audit(c.env, {
    actorType: 'user', actorId: u.id, action: 'payment.submit',
    entityType: 'payment', entityId: paymentId,
    metadata: { plan: body.plan },
  });

  return c.json({ subscription, payment }, 201);
});

// User requests an upgrade — notifies admin
app.post('/request-upgrade', async (c) => {
  const u = c.get('user')!;
  await c.env.DB.prepare(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES (?1, 'Premium plan requested',
             'User ' || ?2 || ' has requested an upgrade to the Premium plan.',
             'premium_request')`
  ).bind(u.id, u.email).run();

  await audit(c.env, {
    actorType: 'user', actorId: u.id, action: 'subscription.request_premium',
    entityType: 'user', entityId: u.id, metadata: {},
  });

  return c.json({ ok: true });
});

app.get('/payments', async (c) => {
  const u = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM payments WHERE user_id=?1 ORDER BY created_at DESC`
  ).bind(u.id).all<any>();
  return c.json({ payments: results });
});

export default app;
