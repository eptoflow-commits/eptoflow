import cron from 'node-cron';
import { query } from '../db/pool.js';
import { config } from '../config/index.js';
import { expireOverdueSubscriptions } from '../services/subscription.service.js';
import { enqueueCommand } from '../services/command.service.js';
import { audit } from '../utils/audit.js';

/**
 * Marks devices offline if they have not heartbeated in
 * config.heartbeat.offlineSeconds and emits a notification (once).
 */
async function markOfflineDevices() {
  const { rows } = await query(
    `UPDATE devices
        SET status='offline'
      WHERE status='online'
        AND (last_seen_at IS NULL OR last_seen_at < NOW() - ($1 || ' seconds')::INTERVAL)
      RETURNING id, user_id, device_name`,
    [config.heartbeat.offlineSeconds]
  );
  for (const d of rows) {
    if (d.user_id) {
      await query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Device offline',
                 'Device "' || $2 || '" has gone offline.',
                 'device')`,
        [d.user_id, d.device_name]
      );
    }
    await audit({
      actorType: 'system', actorId: null, action: 'device.auto_offline',
      entityType: 'device', entityId: d.id,
    });
  }
  return rows.length;
}

/**
 * Notifies users whose subscription expires within 3 days.
 */
async function notifyExpiringSubscriptions() {
  const { rows } = await query(
    `SELECT s.id, s.user_id, s.plan_name,
            EXTRACT(DAY FROM (s.end_date - NOW()))::int AS days_left
       FROM subscriptions s
      WHERE s.status='active'
        AND s.end_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
           WHERE n.user_id=s.user_id
             AND n.type='billing'
             AND n.title='Subscription expiring soon'
             AND n.created_at > NOW() - INTERVAL '24 hours'
        )`
  );
  for (const s of rows) {
    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Subscription expiring soon',
               'Your ' || $2 || ' plan ends in ~' || $3 || ' day(s). Submit a payment to renew.',
               'billing')`,
      [s.user_id, s.plan_name, s.days_left]
    );
  }
  return rows.length;
}

/**
 * Runs schedules that are due in the past minute. Enqueues a `water_for` command.
 * Skip duplicates by checking last_run_at.
 */
async function runDueSchedules() {
  // PostgreSQL DOW: Sun=0 .. Sat=6  → convert to Mon=1..Sun=7
  const { rows } = await query(`
    WITH dow AS (
      SELECT (CASE WHEN EXTRACT(DOW FROM NOW())::int = 0 THEN 7
                   ELSE EXTRACT(DOW FROM NOW())::int END) AS dow_num,
             to_char(NOW(), 'HH24:MI') AS now_hhmm
    )
    SELECT s.* FROM schedules s, dow
     WHERE s.enabled=TRUE
       AND dow.dow_num = ANY(s.days_of_week)
       AND to_char(s.start_time, 'HH24:MI') = dow.now_hhmm
       AND (s.last_run_at IS NULL OR s.last_run_at < NOW() - INTERVAL '60 seconds')
  `);
  for (const s of rows) {
    try {
      await enqueueCommand({
        userId: s.user_id,
        deviceId: s.device_id,
        command: {
          command_type: 'water_for',
          payload: { target: s.zone_or_output, duration: s.duration_seconds },
        },
        source: 'schedule',
      });
      await query(`UPDATE schedules SET last_run_at=NOW() WHERE id=$1`, [s.id]);
    } catch (e) {
      console.warn(`[schedule] failed to enqueue ${s.id}: ${e.message}`);
    }
  }
  return rows.length;
}

export function startCronJobs() {
  // Every minute: schedules + offline detection
  cron.schedule('* * * * *', async () => {
    try {
      const off = await markOfflineDevices();
      const sch = await runDueSchedules();
      if (off || sch) console.log(`[cron] offline=${off} schedulesRun=${sch}`);
    } catch (e) { console.error('[cron 1m] error:', e); }
  });
  // Every 30 minutes: expire subscriptions + reminders
  cron.schedule('*/30 * * * *', async () => {
    try {
      const ex = await expireOverdueSubscriptions();
      const exp = await notifyExpiringSubscriptions();
      if (ex || exp) console.log(`[cron] expired=${ex} expiring=${exp}`);
    } catch (e) { console.error('[cron 30m] error:', e); }
  });
  console.log('[cron] jobs scheduled');
}
