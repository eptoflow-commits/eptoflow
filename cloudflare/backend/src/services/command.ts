import type { Env } from '../env';
import { Err } from '../lib/errors';
import { newId } from '../lib/ids';
import { audit } from '../lib/audit';
import { planAllows } from './plan';
import { getLatest, isActive } from './subscription';

export const COMMAND_TYPES = new Set([
  'valve_on', 'valve_off',
  'relay_on', 'relay_off',
  'water_for', 'stop_all',
]);
export const SAFE_MAX_DURATION = 30 * 60;

export async function enqueue(
  env: Env,
  args: {
    userId: string; deviceId: string;
    command: { command_type: string; payload?: Record<string, any> };
    source: string;
  },
) {
  const type = args.command.command_type;
  if (!COMMAND_TYPES.has(type)) throw Err.badRequest(`Unknown command_type: ${type}`);
  const payload = { ...(args.command.payload || {}) };

  const sub = await getLatest(env, args.userId);
  if (!isActive(sub)) throw Err.subscriptionInactive();
  const plan = sub.plan_name as 'basic' | 'premium';

  let target = payload.target as string | undefined;
  if (type === 'relay_on' || type === 'relay_off') target = 'relay1';
  if (['valve_on', 'valve_off', 'water_for'].includes(type) && !target) {
    throw Err.badRequest('payload.target required');
  }
  if (target && !planAllows(plan, target)) {
    throw Err.planRestricted(`Your ${plan} plan cannot control ${target}`);
  }

  if (type === 'water_for') {
    const d = parseInt(String(payload.duration), 10);
    if (!Number.isFinite(d) || d <= 0) throw Err.badRequest('duration must be > 0 seconds');
    if (d > SAFE_MAX_DURATION) throw Err.badRequest(`duration exceeds safety max (${SAFE_MAX_DURATION}s)`);
    payload.duration = d;
  }
  if (target) payload.target = target;

  const id = newId();
  await env.DB.prepare(
    `INSERT INTO commands (id, device_id, user_id, command_type, payload, source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(id, args.deviceId, args.userId, type, JSON.stringify(payload), args.source || 'manual').run();

  await audit(env, {
    actorType: 'user', actorId: args.userId, action: 'command.enqueue',
    entityType: 'command', entityId: id,
    metadata: { device_id: args.deviceId, command_type: type, source: args.source },
  });

  return env.DB.prepare(`SELECT * FROM commands WHERE id=?1`).bind(id).first<any>();
}

/**
 * Fetch the next pending command for a device, atomically mark it delivered.
 * D1 lacks FOR UPDATE SKIP LOCKED — we use UPDATE ... RETURNING against the
 * oldest pending row, which is atomic for the target row in SQLite.
 */
export async function fetchNext(env: Env, deviceId: string) {
  const oldest = await env.DB.prepare(
    `SELECT id FROM commands
      WHERE device_id=?1 AND status='pending'
      ORDER BY created_at ASC
      LIMIT 1`
  ).bind(deviceId).first<any>();
  if (!oldest) return null;
  const updated = await env.DB.prepare(
    `UPDATE commands
        SET status='delivered', delivered_at=datetime('now')
      WHERE id=?1 AND status='pending'
      RETURNING *`
  ).bind(oldest.id).first<any>();
  if (!updated) return null;
  if (typeof updated.payload === 'string') {
    try { updated.payload = JSON.parse(updated.payload); } catch { /* keep string */ }
  }
  return updated;
}

export async function ack(
  env: Env, deviceId: string, commandId: string,
  { status, error }: { status: 'executed' | 'failed'; error?: string | null },
) {
  return env.DB.prepare(
    `UPDATE commands
        SET status=?3,
            executed_at = CASE WHEN ?3='executed' THEN datetime('now') ELSE executed_at END,
            acknowledged_at = datetime('now'),
            error_message=?4
      WHERE id=?1 AND device_id=?2
      RETURNING *`
  ).bind(commandId, deviceId, status, error ?? null).first<any>();
}
