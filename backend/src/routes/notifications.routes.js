import { Router } from 'express';
import { authUser } from '../middleware/auth.js';
import { asyncH, Errors } from '../utils/http.js';
import { query } from '../db/pool.js';

const router = Router();
router.use(authUser);

router.get('/', asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  const { rows: cnt } = await query(
    `SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id=$1 AND is_read=FALSE`,
    [req.user.id]
  );
  res.json({ notifications: rows, unread: cnt[0].unread });
}));

router.post('/:id/read', asyncH(async (req, res) => {
  const { rowCount } = await query(
    `UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2`,
    [req.params.id, req.user.id]
  );
  if (!rowCount) throw Errors.notFound('Notification');
  res.json({ ok: true });
}));

router.post('/read-all', asyncH(async (req, res) => {
  await query(`UPDATE notifications SET is_read=TRUE WHERE user_id=$1`, [req.user.id]);
  res.json({ ok: true });
}));

export default router;
