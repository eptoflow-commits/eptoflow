import { query } from '../db/pool.js';

export async function audit({ actorType, actorId, action, entityType, entityId, metadata }) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorType, actorId || null, action, entityType || null, entityId || null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (e) {
    // Audit must never break main flow
    console.error('[audit] failed:', e.message);
  }
}
