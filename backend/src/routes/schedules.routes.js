import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authUser, loadSubscription } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncH, Errors } from '../utils/http.js';
import { planAllows } from '../services/plan.service.js';

const router = Router();
router.use(authUser, loadSubscription({ requireActive: true }));

const scheduleSchema = z.object({
  device_id: z.string().uuid(),
  zone_or_output: z.enum(['valve1', 'valve2', 'valve3', 'relay1']),
  days_of_week: z.array(z.number().int().min(1).max(7)).min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  duration_seconds: z.number().int().min(1).max(3600),
  enabled: z.boolean().default(true),
});

router.get('/', asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT s.*
       FROM schedules s
       JOIN devices d ON d.id = s.device_id
      WHERE s.user_id=$1 AND d.user_id=$1
      ORDER BY s.created_at DESC`,
    [req.user.id]
  );
  res.json({ schedules: rows });
}));

router.post('/', validate(scheduleSchema), asyncH(async (req, res) => {
  const { device_id, zone_or_output } = req.body;
  // Confirm device ownership
  const { rows: dev } = await query(
    `SELECT id, plan_bound FROM devices WHERE id=$1 AND user_id=$2`,
    [device_id, req.user.id]
  );
  if (!dev[0]) throw Errors.notFound('Device');
  if (!planAllows(dev[0].plan_bound, zone_or_output)) {
    throw Errors.planRestricted(`${zone_or_output} not available on ${dev[0].plan_bound} plan`);
  }
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO schedules
       (user_id, device_id, zone_or_output, days_of_week, start_time, duration_seconds, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [req.user.id, device_id, zone_or_output, b.days_of_week, b.start_time,
     b.duration_seconds, b.enabled]
  );
  res.status(201).json({ schedule: rows[0] });
}));

router.patch('/:id', asyncH(async (req, res) => {
  const allowed = ['enabled', 'days_of_week', 'start_time', 'duration_seconds'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const k of allowed) {
    if (k in req.body) { updates.push(`${k}=$${i++}`); values.push(req.body[k]); }
  }
  if (!updates.length) throw Errors.badRequest('No fields to update');
  values.push(req.params.id, req.user.id);
  const { rows } = await query(
    `UPDATE schedules SET ${updates.join(', ')}
      WHERE id=$${i++} AND user_id=$${i}
      RETURNING *`,
    values
  );
  if (!rows[0]) throw Errors.notFound('Schedule');
  res.json({ schedule: rows[0] });
}));

router.delete('/:id', asyncH(async (req, res) => {
  const { rowCount } = await query(
    `DELETE FROM schedules WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.user.id]
  );
  if (!rowCount) throw Errors.notFound('Schedule');
  res.json({ ok: true });
}));

export default router;
