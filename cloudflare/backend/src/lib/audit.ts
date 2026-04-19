import type { Env } from '../env';

export async function audit(
  env: Env,
  row: {
    actorType: 'user' | 'admin' | 'device' | 'system';
    actorId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: unknown;
  },
) {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id, metadata)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(
      row.actorType,
      row.actorId ?? null,
      row.action,
      row.entityType ?? null,
      row.entityId ?? null,
      row.metadata ? JSON.stringify(row.metadata) : null
    ).run();
  } catch (e) {
    console.error('[audit] failed:', e);
  }
}
