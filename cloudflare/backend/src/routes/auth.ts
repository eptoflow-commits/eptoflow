import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { AppCtx } from '../lib/middleware';
import { authUser } from '../lib/middleware';
import { Err } from '../lib/errors';
import { signJWT } from '../lib/jwt';
import { newId } from '../lib/ids';
import { audit } from '../lib/audit';

const app = new Hono<AppCtx>();

const signupSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(24).optional(),
  password: z.string().min(8).max(128),
});

app.post('/signup', async (c) => {
  const body = signupSchema.parse(await c.req.json());
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email=?1`)
    .bind(body.email).first();
  if (existing) throw Err.conflict('Email already registered');
  const id = newId();
  const hash = await bcrypt.hash(body.password, 10);
  await c.env.DB.prepare(
    `INSERT INTO users (id, full_name, email, phone, password_hash)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(id, body.full_name, body.email, body.phone ?? null, hash).run();
  const user = await c.env.DB.prepare(
    `SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id=?1`
  ).bind(id).first<any>();
  await audit(c.env, { actorType: 'user', actorId: id, action: 'user.signup' });
  const token = await signJWT({ sub: id, email: body.email }, c.env.JWT_SECRET,
                               c.env.JWT_EXPIRES_IN || '7d', 'user');
  return c.json({ user, token }, 201);
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post('/login', async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE email=?1`)
    .bind(body.email).first<any>();
  if (!user) throw Err.unauthorized('Invalid credentials');
  if (user.status !== 'active') throw Err.forbidden('Account disabled');
  const ok = await bcrypt.compare(body.password, user.password_hash);
  if (!ok) throw Err.unauthorized('Invalid credentials');
  await audit(c.env, { actorType: 'user', actorId: user.id, action: 'user.login' });
  const token = await signJWT({ sub: user.id, email: user.email },
                               c.env.JWT_SECRET, c.env.JWT_EXPIRES_IN || '7d', 'user');
  return c.json({
    user: {
      id: user.id, full_name: user.full_name, email: user.email,
      phone: user.phone, role: user.role, status: user.status,
    },
    token,
  });
});

app.get('/me', authUser, async (c) => {
  const u = c.get('user')!;
  const user = await c.env.DB.prepare(
    `SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id=?1`
  ).bind(u.id).first<any>();
  if (!user) throw Err.notFound('User');
  return c.json({ user });
});

app.post('/admin/login', async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const admin = await c.env.DB.prepare(`SELECT * FROM admins WHERE email=?1`)
    .bind(body.email).first<any>();
  if (!admin) throw Err.unauthorized('Invalid credentials');
  if (admin.status !== 'active') throw Err.forbidden('Account disabled');
  const ok = await bcrypt.compare(body.password, admin.password_hash);
  if (!ok) throw Err.unauthorized('Invalid credentials');
  await audit(c.env, { actorType: 'admin', actorId: admin.id, action: 'admin.login' });
  const token = await signJWT({ sub: admin.id, email: admin.email },
                               c.env.ADMIN_JWT_SECRET, c.env.JWT_EXPIRES_IN || '7d', 'admin');
  return c.json({
    admin: { id: admin.id, full_name: admin.full_name, email: admin.email, role: admin.role },
    token,
  });
});

export default app;
