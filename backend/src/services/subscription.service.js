import { query } from '../db/pool.js';
import { config } from '../config/index.js';
import { audit } from '../utils/audit.js';

export async function getLatestSubscription(userId) {
  const { rows } = await query(
    `SELECT * FROM subscriptions WHERE user_id=$1 ORDER BY end_date DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export function isSubscriptionActive(sub) {
  if (!sub) return false;
  return sub.status === 'active' && new Date(sub.end_date) > new Date();
}

/**
 * Creates a new pending subscription when a user submits a payment intent.
 */
export async function createPendingSubscription(userId, planName) {
  const plan = config.subscription.plans[planName];
  if (!plan) throw new Error('Unknown plan');
  const { rows } = await query(
    `INSERT INTO subscriptions (user_id, plan_name, amount, start_date, end_date, status)
     VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${config.subscription.durationDays} days', 'pending')
     RETURNING *`,
    [userId, plan.name, plan.amount]
  );
  return rows[0];
}

/**
 * Activates or renews a subscription from NOW() for the given number of days.
 * Always resets end_date from today — does NOT stack on top of existing end_date.
 */
export async function activateOrRenew({ subscriptionId, adminId, userId, planName, paymentReference, days }) {
  const durationDays = days || config.subscription.durationDays;
  // Reuse row if it exists and belongs to user; otherwise create a new row.
  if (subscriptionId) {
    const { rows } = await query(
      `UPDATE subscriptions
         SET status='active',
             start_date=NOW(),
             end_date = NOW() + ($2 || ' days')::INTERVAL,
             manually_verified_by_admin=$3,
             renewed_at=NOW(),
             payment_reference=COALESCE($4, payment_reference)
       WHERE id=$1
       RETURNING *`,
      [subscriptionId, String(durationDays), adminId, paymentReference || null]
    );
    if (rows[0]) {
      await audit({
        actorType: 'admin', actorId: adminId, action: 'subscription.activate',
        entityType: 'subscription', entityId: rows[0].id,
        metadata: { plan_name: rows[0].plan_name, days: durationDays },
      });
      return rows[0];
    }
  }
  // Create fresh subscription
  const plan = config.subscription.plans[planName];
  if (!plan) throw new Error('Unknown plan');
  const { rows } = await query(
    `INSERT INTO subscriptions (user_id, plan_name, amount, start_date, end_date,
                                status, manually_verified_by_admin, payment_reference)
     VALUES ($1,$2,$3, NOW(), NOW() + ($4 || ' days')::INTERVAL,
             'active', $5, $6)
     RETURNING *`,
    [userId, plan.name, plan.amount, String(durationDays), adminId, paymentReference || null]
  );
  await audit({
    actorType: 'admin', actorId: adminId, action: 'subscription.create+activate',
    entityType: 'subscription', entityId: rows[0].id,
    metadata: { plan_name: plan.name, days: durationDays },
  });
  return rows[0];
}

/**
 * Marks expired subscriptions as expired and emits a notification.
 * Called by cron job.
 */
export async function expireOverdueSubscriptions() {
  const { rows } = await query(
    `UPDATE subscriptions
        SET status='expired'
      WHERE status='active' AND end_date <= NOW()
      RETURNING id, user_id, plan_name`
  );
  for (const s of rows) {
    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Subscription expired',
               'Your ' || $2 || ' subscription has expired. Please renew to continue using automation.',
               'billing')`,
      [s.user_id, s.plan_name]
    );
    await audit({
      actorType: 'system', actorId: null, action: 'subscription.auto_expire',
      entityType: 'subscription', entityId: s.id, metadata: null,
    });
  }
  return rows.length;
}
