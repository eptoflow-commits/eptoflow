import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppCtx } from './lib/middleware';
import { cfg } from './env';
import type { Env } from './env';
import { sendError } from './lib/errors';
import { newId } from './lib/ids';
import { audit } from './lib/audit';
import { enqueue } from './services/command';
import { expireOverdue } from './services/subscription';

import authRoutes from './routes/auth';
import devicesRoutes from './routes/devices';
import deviceApiRoutes from './routes/deviceApi';
import schedulesRoutes from './routes/schedules';
import subscriptionsRoutes from './routes/subscriptions';
import voiceRoutes from './routes/voice';
import notificationsRoutes from './routes/notifications';
import adminRoutes from './routes/admin';

const app = new Hono<AppCtx>();

app.use('*', async (c, next) => {
  const origins = cfg(c.env).allowedOrigins;
  const mw = cors({
    origin: (o) => (o && origins.includes(o) ? o : origins[0] || '*'),
    credentials: true,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  return mw(c, next);
});

app.get('/health', (c) =>
  c.json({ ok: true, service: 'eptoflow-api', time: new Date().toISOString() }),
);

app.route('/api/auth', authRoutes);
app.route('/api/devices', devicesRoutes);
app.route('/api/device', deviceApiRoutes);
app.route('/api/schedules', schedulesRoutes);
app.route('/api/subscriptions', subscriptionsRoutes);
app.route('/api/voice', voiceRoutes);
app.route('/api/notifications', notificationsRoutes);
app.route('/api/admin', adminRoutes);

app.onError((err, c) => sendError(c, err));
app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404),
);

// ============================================================================
// Background jobs (Cloudflare cron triggers)
// ============================================================================

/**
 * Mark devices offline whose last heartbeat is older than the threshold.
 * Returns count marked offline.
 */
async function markOfflineDevices(env: Env): Promise<number> {
  const thresholdSec = cfg(env).heartbeatOfflineSeconds;
  const cutoffIso = new Date(Date.now() - thresholdSec * 1000).toISOString();

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, device_name FROM devices
      WHERE status='online'
        AND (last_seen_at IS NULL OR last_seen_at < ?1)`
  ).bind(cutoffIso).all<any>();

  for (const d of results) {
    await env.DB.prepare(
      `UPDATE devices SET status='offline', updated_at=datetime('now') WHERE id=?1`
    ).bind(d.id).run();
    if (d.user_id) {
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, message, type)
         VALUES (?1, ?2, 'Device offline',
                 'Device "' || ?3 || '" has gone offline.',
                 'device')`
      ).bind(newId(), d.user_id, d.device_name).run();
    }
    await audit(env, {
      actorType: 'system', action: 'device.auto_offline',
      entityType: 'device', entityId: d.id,
    });
  }
  return results.length;
}

/**
 * Run schedules due this minute. Enqueue water_for commands and update
 * last_run_at. Uses the current UTC time (wall-clock from Cloudflare).
 */
async function runDueSchedules(env: Env): Promise<number> {
  const now = new Date();
  // Convert JS DOW (Sun=0..Sat=6) to Mon=1..Sun=7
  const jsDow = now.getUTCDay(); // 0..6
  const dow = jsDow === 0 ? 7 : jsDow;

  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const nowHHmm = `${hh}:${mm}`;

  const cutoffIso = new Date(now.getTime() - 60_000).toISOString();

  // Pull candidates. days_of_week stored as comma-CSV (e.g. "1,2,3").
  // Use GLOB to check membership of the dow digit.
  // Match any of: "N", "N,...", "...,N", "...,N,..."
  const dowStr = String(dow);
  const { results } = await env.DB.prepare(
    `SELECT * FROM schedules
      WHERE enabled=1
        AND (',' || days_of_week || ',') LIKE ?1
        AND substr(start_time, 1, 5) = ?2
        AND (last_run_at IS NULL OR last_run_at < ?3)`
  ).bind(`%,${dowStr},%`, nowHHmm, cutoffIso).all<any>();

  let ran = 0;
  for (const s of results) {
    try {
      await enqueue(env, {
        userId: s.user_id,
        deviceId: s.device_id,
        command: {
          command_type: 'water_for',
          payload: { target: s.zone_or_output, duration: s.duration_seconds },
        },
        source: 'schedule',
      });
      await env.DB.prepare(
        `UPDATE schedules SET last_run_at=datetime('now'), updated_at=datetime('now')
          WHERE id=?1`
      ).bind(s.id).run();
      ran++;
    } catch (e: any) {
      console.warn(`[schedule] ${s.id} failed: ${e?.message || e}`);
    }
  }
  return ran;
}

/**
 * Notify users whose subscription ends in <= 3 days (once per 24h).
 */
async function notifyExpiringSubscriptions(env: Env): Promise<number> {
  const nowIso = new Date().toISOString();
  const threeDaysIso = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const dayAgoIso = new Date(Date.now() - 86_400_000).toISOString();

  const { results } = await env.DB.prepare(
    `SELECT s.id, s.user_id, s.plan_name, s.end_date
       FROM subscriptions s
      WHERE s.status='active'
        AND s.end_date BETWEEN ?1 AND ?2
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
           WHERE n.user_id=s.user_id
             AND n.type='billing'
             AND n.title='Subscription expiring soon'
             AND n.created_at > ?3
        )`
  ).bind(nowIso, threeDaysIso, dayAgoIso).all<any>();

  for (const s of results) {
    const endMs = Date.parse((s.end_date as string).replace(' ', 'T') + 'Z');
    const daysLeft = Math.max(1, Math.ceil((endMs - Date.now()) / 86_400_000));
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type)
       VALUES (?1, ?2, 'Subscription expiring soon',
               'Your ' || ?3 || ' plan ends in ~' || ?4 || ' day(s). Submit a payment to renew.',
               'billing')`
    ).bind(newId(), s.user_id, s.plan_name, daysLeft).run();
  }
  return results.length;
}

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Dispatch by cron pattern so each trigger does exactly its own work.
    // (Both `*/1 * * * *` and `*/30 * * * *` fire at :00 and :30.)
    ctx.waitUntil((async () => {
      try {
        if (event.cron === '*/1 * * * *') {
          const off = await markOfflineDevices(env);
          const sch = await runDueSchedules(env);
          if (off || sch) console.log(`[cron 1m] offline=${off} scheduled=${sch}`);
        } else if (event.cron === '*/30 * * * *') {
          const ex  = await expireOverdue(env);
          const exp = await notifyExpiringSubscriptions(env);
          if (ex || exp) console.log(`[cron 30m] expired=${ex} expiring=${exp}`);
        }
      } catch (e) {
        console.error('[scheduled] error:', e);
      }
    })());
  },
};
