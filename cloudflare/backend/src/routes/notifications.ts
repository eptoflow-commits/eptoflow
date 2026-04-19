import { Hono } from 'hono';
import type { AppCtx } from '../lib/middleware';
import { authUser } from '../lib/middleware';
import { Err } from '../lib/errors';

const app = new Hono<AppCtx>();
app.use('*', authUser);

app.get('/', async (c) => {
  const u = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE user_id=?1 ORDER BY created_at DESC LIMIT 100`
  ).bind(u.id).all<any>();
  const cnt = await c.env.DB.prepare(
    `SELECT COUNT(*) AS unread FROM notifications WHERE user_id=?1 AND is_read=0`
  ).bind(u.id).first<any>();
  return c.json({
    notifications: results.map((r: any) => ({ ...r, is_read: !!r.is_read })),
    unread: Number(cnt?.unread || 0),
  });
});

app.post('/:id/read', async (c) => {
  const u = c.get('user')!;
  const res = await c.env.DB.prepare(
    `UPDATE notifications SET is_read=1 WHERE id=?1 AND user_id=?2`
  ).bind(c.req.param('id'), u.id).run();
  if (!res.meta.changes) throw Err.notFound('Notification');
  return c.json({ ok: true });
});

app.post('/read-all', async (c) => {
  const u = c.get('user')!;
  await c.env.DB.prepare(`UPDATE notifications SET is_read=1 WHERE user_id=?1`)
    .bind(u.id).run();
  return c.json({ ok: true });
});

export default app;
