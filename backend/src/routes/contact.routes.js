import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db/pool.js';
import { validate } from '../middleware/validate.js';
import { asyncH } from '../utils/http.js';

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60_000, // 1 hour
  max: 5,                 // max 5 requests per IP per hour
  standardHeaders: true,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});

const contactSchema = z.object({
  full_name: z.string().min(2).max(120),
  email:     z.string().email().max(160),
  phone:     z.string().min(5).max(24),
  plan:      z.enum(['basic', 'standard', 'premium', 'custom']),
  message:   z.string().max(1000).optional(),
});

router.post('/', contactLimiter, validate(contactSchema), asyncH(async (req, res) => {
  const { full_name, email, phone, plan, message } = req.body;
  const { rows } = await query(
    `INSERT INTO contact_requests (full_name, email, phone, plan, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [full_name, email, phone, plan, message || null]
  );
  res.status(201).json({ ok: true, id: rows[0].id });
}));

export default router;
