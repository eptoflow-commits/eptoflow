import { query, tx } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { Errors } from '../utils/http.js';
import { planAllows } from './plan.service.js';
import { isSubscriptionActive, getLatestSubscription } from './subscription.service.js';

export const COMMAND_TYPES = new Set([
  'valve_on', 'valve_off',
  'relay_on', 'relay_off',
  'water_for',          // payload: { target: 'valve1', duration: seconds }
  'stop_all',
  'activate_relay',     // payload: { relay_key, activated }
  'sync_automation',    // payload: { valve_key, rule }
  'push_config',        // payload: { licenses, rules, zones }
  'reboot',             // payload: {}
]);

export const SAFE_MAX_DURATION = 30 * 60; // 30 minutes absolute ceiling

/**
 * Validates the command against plan and safety rules, then enqueues it.
 * Callers must provide user + device (ownership already enforced).
 */
export async function enqueueCommand({ userId, deviceId, command, source }) {
  const type = command.command_type;
  if (!COMMAND_TYPES.has(type)) {
    throw Errors.badRequest(`Unknown command_type: ${type}`);
  }
  const payload = command.payload || {};

  // Fetch user's subscription for plan enforcement
  const sub = await getLatestSubscription(userId);
  if (!isSubscriptionActive(sub)) throw Errors.subscriptionInactive();
  const planName = sub.plan_name;

  // Determine target output (for non stop_all commands)
  let target = payload.target;
  if (type === 'relay_on' || type === 'relay_off') target = 'relay1';
  if (type === 'valve_on' || type === 'valve_off' || type === 'water_for') {
    if (!target) throw Errors.badRequest('payload.target required');
  }
  if (target && !planAllows(planName, target)) {
    throw Errors.planRestricted(`Your ${planName} plan cannot control ${target}`);
  }

  // Duration safety
  if (type === 'water_for') {
    const dur = parseInt(payload.duration, 10);
    if (!Number.isFinite(dur) || dur <= 0) throw Errors.badRequest('duration must be > 0 seconds');
    if (dur > SAFE_MAX_DURATION) throw Errors.badRequest(`duration exceeds safety max (${SAFE_MAX_DURATION}s)`);
  }

  const { rows } = await query(
    `INSERT INTO commands (device_id, user_id, command_type, payload, source)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [deviceId, userId, type, JSON.stringify({ ...payload, target }), source || 'manual']
  );

  await audit({
    actorType: 'user', actorId: userId, action: 'command.enqueue',
    entityType: 'command', entityId: rows[0].id,
    metadata: { device_id: deviceId, command_type: type, source },
  });

  return rows[0];
}

/**
 * Fetches the next pending command for a device and marks it as delivered.
 */
export async function fetchNextCommand(deviceId) {
  return tx(async (c) => {
    const { rows } = await c.query(
      `SELECT id FROM commands
        WHERE device_id=$1 AND status='pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [deviceId]
    );
    if (!rows[0]) return null;
    const { rows: up } = await c.query(
      `UPDATE commands SET status='delivered', delivered_at=NOW()
        WHERE id=$1
      RETURNING *`,
      [rows[0].id]
    );
    return up[0];
  });
}

export async function ackCommand(deviceId, commandId, { status, error }) {
  const newStatus = status === 'executed' ? 'executed' : 'failed';
  const { rows } = await query(
    `UPDATE commands
        SET status=$3,
            executed_at = CASE WHEN $3='executed' THEN NOW() ELSE executed_at END,
            acknowledged_at = NOW(),
            error_message = $4
      WHERE id=$1 AND device_id=$2
      RETURNING *`,
    [commandId, deviceId, newStatus, error || null]
  );
  return rows[0] || null;
}
