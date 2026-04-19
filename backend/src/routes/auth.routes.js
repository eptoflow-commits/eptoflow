import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query } from '../db/pool.js';
import { validate } from '../middleware/validate.js';
import { asyncH, Errors } from '../utils/http.js';
import { signUserToken, signAdminToken, authUser } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true });

const signupSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(24).optional(),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/signup',
  loginLimiter,
  validate(signupSchema),
  asyncH(async (req, res) => {
    const { full_name, email, phone, password } = req.body;
    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rowCount) throw Errors.conflict('Email already registered');
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES ($1,$2,$3,$4)
       RETURNING id, full_name, email, phone, role, status, created_at`,
      [full_name, email, phone || null, hash]
    );
    const user = rows[0];
    await audit({ actorType: 'user', actorId: user.id, action: 'user.signup' });
    res.status(201).json({ user, token: signUserToken(user) });
  })
);

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncH(async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];
    if (!user) throw Errors.unauthorized('Invalid credentials');
    if (user.status !== 'active') throw Errors.forbidden('Account disabled');
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw Errors.unauthorized('Invalid credentials');
    await audit({ actorType: 'user', actorId: user.id, action: 'user.login' });
    res.json({
      user: {
        id: user.id, full_name: user.full_name, email: user.email,
        phone: user.phone, role: user.role, status: user.status,
      },
      token: signUserToken(user),
    });
  })
);

router.get('/me', authUser, asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id=$1`,
    [req.user.id]
  );
  if (!rows[0]) throw Errors.notFound('User');
  res.json({ user: rows[0] });
}));

router.post(
  '/admin/login',
  loginLimiter,
  validate(loginSchema),
  asyncH(async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM admins WHERE email=$1', [email]);
    const admin = rows[0];
    if (!admin) throw Errors.unauthorized('Invalid credentials');
    if (admin.status !== 'active') throw Errors.forbidden('Account disabled');
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) throw Errors.unauthorized('Invalid credentials');
    await audit({ actorType: 'admin', actorId: admin.id, action: 'admin.login' });
    res.json({
      admin: { id: admin.id, full_name: admin.full_name, email: admin.email, role: admin.role },
      token: signAdminToken(admin),
    });
  })
);

export default router;
