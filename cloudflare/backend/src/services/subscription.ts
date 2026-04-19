import type { Env } from '../env';
import { cfg } from '../env';
import { newId } from '../lib/ids';
import { audit } from '../lib/audit';
import type { PlanName } from './plan';

export async function getLatest(env: Env, userId: string) {
  return env.DB.prepare(
    `SELECT * FROM subscriptions WHERE user_id=?1 ORDER BY end_date DESC LIMIT 1`
  ).bind(userId).first<any>();
}

export function isActive(sub: any): boolean {
  if (!sub) return false;
  const end = Date.parse((sub.end_date as string).replace(' ', 'T') + 'Z');
  return sub.status === 'active' && end > Date.now();
}

export async function createPending(env: Env, userId: string, plan: PlanName) {
  const c = cfg(env);
  const info = c.plans[plan];
  const id = newId();
  const endIso = new Date(Date.now() + c.subscriptionDays * 86_400_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO subscriptions (id, user_id, plan_name, amount, end_date, status)
     VALUES (?1, ?2, ?3, ?4, ?5, 'pending')`
  ).bind(id, userId, info.name, info.amount, endIso).run();
  return env.DB.prepare(`SELECT * FROM subscriptions WHERE id=?1`).bind(id).first<any>();
}

/** Activate or extend by +N days (config). Admin only. */
export async function activateOrRenew(
  env: Env,
  args: {
    subscriptionId?: string | null;
    adminId: string;
    userId: string;
    planName: PlanName;
    paymentReference?: string | null;
  },
) {
  const c = cfg(env);
  const addMs = c.subscriptionDays * 86_400_000;

  // Try to extend the existing row.
  if (args.subscriptionId) {
    const row = await env.DB.prepare(`SELECT * FROM subscriptions WHERE id=?1`)
      .bind(args.subscriptionId).first<any>();
    if (row) {
      const currentEndMs = Date.parse((row.end_date as string).replace(' ', 'T') + 'Z');
      const baseMs = Math.max(currentEndMs, Date.now());
      const newEndIso = new Date(baseMs + addMs).toISOString();
      await env.DB.prepare(
        `UPDATE subscriptions
            SET status='active',
                start_date=datetime('now'),
                end_date=?2,
                manually_verified_by_admin=?3,
                renewed_at=datetime('now'),
                payment_reference=COALESCE(?4, payment_reference),
                updated_at=datetime('now')
          WHERE id=?1`
      ).bind(args.subscriptionId, newEndIso, args.adminId, args.paymentReference ?? null).run();
      await audit(env, {
        actorType: 'admin', actorId: args.adminId, action: 'subscription.activate',
        entityType: 'subscription', entityId: args.subscriptionId,
        metadata: { plan_name: row.plan_name },
      });
      return env.DB.prepare(`SELECT * FROM subscriptions WHERE id=?1`)
        .bind(args.subscriptionId).first<any>();
    }
  }

  // Create fresh
  const info = c.plans[args.planName];
  const id = newId();
  const endIso = new Date(Date.now() + addMs).toISOString();
  await env.DB.prepare(
    `INSERT INTO subscriptions
       (id, user_id, plan_name, amount, end_date, status,
        manually_verified_by_admin, payment_reference)
     VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7)`
  ).bind(id, args.userId, info.name, info.amount, endIso, args.adminId,
         args.paymentReference ?? null).run();
  await audit(env, {
    actorType: 'admin', actorId: args.adminId, action: 'subscription.create+activate',
    entityType: 'subscription', entityId: id, metadata: { plan_name: info.name },
  });
  return env.DB.prepare(`SELECT * FROM subscriptions WHERE id=?1`).bind(id).first<any>();
}

/** Mark expired overdue subscriptions + notify; called by cron */
export async function expireOverdue(env: Env) {
  const nowIso = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, plan_name FROM subscriptions
      WHERE status='active' AND end_date <= ?1`
  ).bind(nowIso).all<any>();
  for (const s of results) {
    await env.DB.prepare(`UPDATE subscriptions SET status='expired' WHERE id=?1`)
      .bind(s.id).run();
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type)
       VALUES (?1, ?2, 'Subscription expired',
               'Your ' || ?3 || ' subscription has expired. Please renew to continue automation.',
               'billing')`
    ).bind(newId(), s.user_id, s.plan_name).run();
    await audit(env, {
      actorType: 'system', action: 'subscription.auto_expire',
      entityType: 'subscription', entityId: s.id,
    });
  }
  return results.length;
}
