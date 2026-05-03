import { Router } from 'express';
import { z } from 'zod';
import { authUser, loadSubscription } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncH, Errors } from '../utils/http.js';
import { query } from '../db/pool.js';
import { config } from '../config/index.js';
import { serializePlan } from '../services/plan.service.js';
import { createPendingSubscription } from '../services/subscription.service.js';
import { audit } from '../utils/audit.js';

const router = Router();
router.use(authUser, loadSubscription());

router.get('/me', asyncH(async (req, res) => {
  const sub = req.subscription;
  res.json({
    subscription: sub?.plan_name ? sub : null,
    plan: sub?.plan_name ? serializePlan(sub.plan_name) : null,
    plans_catalog: {
      basic: { ...config.subscription.plans.basic, ...serializePlan('basic') },
      premium: { ...config.subscription.plans.premium, ...serializePlan('premium') },
    },
  });
}));

// User submits a payment intent for a plan. Creates a pending subscription +
// pending payment record. Admin later verifies.
const payIntentSchema = z.object({
  plan: z.enum(['basic', 'premium']),
  payment_reference: z.string().max(200).optional(),
  screenshot_url_or_note: z.string().max(4000).optional(),
});
router.post('/payment-intent', validate(payIntentSchema), asyncH(async (req, res) => {
  const { plan, payment_reference, screenshot_url_or_note } = req.body;
  const planData = config.subscription.plans[plan];
  const subscription = await createPendingSubscription(req.user.id, plan);
  const { rows } = await query(
    `INSERT INTO payments
      (user_id, subscription_id, amount, payment_mode, payment_reference, screenshot_url_or_note)
     VALUES ($1,$2,$3,'manual',$4,$5)
     RETURNING *`,
    [req.user.id, subscription.id, planData.amount, payment_reference || null,
     screenshot_url_or_note || null]
  );
  await audit({
    actorType: 'user', actorId: req.user.id, action: 'payment.submit',
    entityType: 'payment', entityId: rows[0].id, metadata: { plan },
  });
  res.status(201).json({ subscription, payment: rows[0] });
}));

// User requests Premium upgrade — admin gets notified
router.post('/request-upgrade', asyncH(async (req, res) => {
  await query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES ($1, 'Premium plan requested',
             'User ' || $2 || ' has requested an upgrade to the Premium plan.',
             'premium_request')`,
    [req.user.id, req.user.email]
  );
  await audit({ actorType: 'user', actorId: req.user.id, action: 'subscription.request_premium' });
  res.json({ ok: true });
}));

router.get('/payments', asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ payments: rows });
}));

export default router;
