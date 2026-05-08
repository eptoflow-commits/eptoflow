import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncH, Errors } from '../utils/http.js';
import { query, tx } from '../db/pool.js';
import { activateOrRenew } from '../services/subscription.service.js';
import { audit } from '../utils/audit.js';
import crypto from 'crypto';

const router = Router();
router.use(authAdmin);

// ----- Dashboard ------------------------------------------------------------
router.get('/dashboard', asyncH(async (_req, res) => {
  const [users, activeSubs, expiredSubs, pendingPayments, onlineDevices, offlineDevices, premiumReqs, newContacts] =
    await Promise.all([
      query(`SELECT COUNT(*)::int AS c FROM users`),
      query(`SELECT COUNT(*)::int AS c FROM subscriptions WHERE status='active' AND end_date>NOW()`),
      query(`SELECT COUNT(*)::int AS c FROM subscriptions WHERE status='expired' OR (status='active' AND end_date<=NOW())`),
      query(`SELECT COUNT(*)::int AS c FROM payments WHERE verification_status='pending'`),
      query(`SELECT COUNT(*)::int AS c FROM devices WHERE status='online'`),
      query(`SELECT COUNT(*)::int AS c FROM devices WHERE status<>'online'`),
      query(`SELECT COUNT(*)::int AS c FROM notifications WHERE type='premium_request' AND is_read=false`),
      query(`SELECT COUNT(*)::int AS c FROM contact_requests WHERE status='new'`),
    ]);
  res.json({
    totals: {
      users: users.rows[0].c,
      active_subscriptions: activeSubs.rows[0].c,
      expired_subscriptions: expiredSubs.rows[0].c,
      pending_payments: pendingPayments.rows[0].c,
      online_devices: onlineDevices.rows[0].c,
      offline_devices: offlineDevices.rows[0].c,
      premium_requests: premiumReqs.rows[0].c,
      new_contacts: newContacts.rows[0].c,
    },
  });
}));

// ----- Contact Requests (pre-signup enquiries) --------------------------------
router.get('/contact-requests', asyncH(async (_req, res) => {
  const { rows } = await query(
    `SELECT * FROM contact_requests ORDER BY created_at DESC LIMIT 200`
  );
  res.json({ contact_requests: rows });
}));

router.patch('/contact-requests/:id', asyncH(async (req, res) => {
  const { status } = req.body;
  if (!['new','contacted','done'].includes(status)) {
    return res.status(400).json({ error: { message: 'Invalid status' } });
  }
  const { rows } = await query(
    `UPDATE contact_requests SET status=$1 WHERE id=$2 RETURNING *`,
    [status, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ contact_request: rows[0] });
}));

// ----- Users ----------------------------------------------------------------
router.get('/users', asyncH(async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at,
            s.plan_name, s.status AS sub_status, s.end_date, s.id AS sub_id,
            GREATEST(0, EXTRACT(DAY FROM (s.end_date - NOW()))::int) AS days_left
       FROM users u
       LEFT JOIN LATERAL (SELECT id, plan_name, status, end_date FROM subscriptions
                          WHERE user_id=u.id ORDER BY end_date DESC LIMIT 1) s ON TRUE
       ORDER BY u.created_at DESC`
  );
  res.json({ users: rows });
}));

const createUserSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(24).optional(),
  password: z.string().min(6).max(128),
});
router.post('/users/create', validate(createUserSchema), asyncH(async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rowCount) throw Errors.conflict('Email already registered');
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (full_name, email, phone, password_hash)
     VALUES ($1,$2,$3,$4) RETURNING id, full_name, email, phone, status`,
    [full_name, email, phone || null, hash]
  );
  await audit({ actorType: 'admin', actorId: req.admin.id, action: 'user.create', entityType: 'user', entityId: rows[0].id });
  res.status(201).json({ user: rows[0] });
}));

const editUserSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  email:     z.string().email().max(160).optional(),
  phone:     z.string().max(24).optional().nullable(),
});
router.patch('/users/:id', validate(editUserSchema), asyncH(async (req, res) => {
  const allowed = ['full_name', 'email', 'phone'];
  const updates = []; const values = []; let i = 1;
  for (const k of allowed) {
    if (k in req.body) { updates.push(`${k}=$${i++}`); values.push(req.body[k]); }
  }
  if (!updates.length) throw Errors.badRequest('No fields to update');
  values.push(req.params.id);
  const { rows } = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id=$${i} RETURNING id, full_name, email, phone, status`,
    values
  );
  if (!rows[0]) throw Errors.notFound('User');
  await audit({ actorType: 'admin', actorId: req.admin.id, action: 'user.edit', entityType: 'user', entityId: rows[0].id });
  res.json({ user: rows[0] });
}));

router.post('/users/:id/status', asyncH(async (req, res) => {
  const status = req.body?.status;
  if (!['active', 'suspended'].includes(status)) throw Errors.badRequest('status must be active|suspended');
  const { rowCount } = await query(`UPDATE users SET status=$2 WHERE id=$1`, [req.params.id, status]);
  if (!rowCount) throw Errors.notFound('User');
  await audit({ actorType: 'admin', actorId: req.admin.id, action: `user.${status}`, entityType: 'user', entityId: req.params.id });
  res.json({ ok: true });
}));

router.delete('/users/:id', asyncH(async (req, res) => {
  const { rowCount } = await query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
  if (!rowCount) throw Errors.notFound('User');
  await audit({ actorType: 'admin', actorId: req.admin.id, action: 'user.delete', entityType: 'user', entityId: req.params.id });
  res.json({ ok: true });
}));

// ----- Devices --------------------------------------------------------------
router.get('/devices', asyncH(async (_req, res) => {
  const { rows } = await query(
    `SELECT d.*, u.email AS user_email, u.full_name AS user_name FROM devices d
      LEFT JOIN users u ON u.id=d.user_id
      ORDER BY d.created_at DESC`
  );
  res.json({ devices: rows });
}));

const provisionSchema = z.object({
  user_id: z.string().uuid(),
  plan_bound: z.enum(['basic', 'standard', 'premium']),
  device_name: z.string().min(1).max(80).optional(),
});
router.post('/devices/provision', validate(provisionSchema), asyncH(async (req, res) => {
  const { user_id, plan_bound, device_name } = req.body;
  const userCheck = await query('SELECT id FROM users WHERE id=$1', [user_id]);
  if (!userCheck.rowCount) throw Errors.notFound('User');

  const uid = 'EPT-' + crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const secret = crypto.randomBytes(24).toString('hex');
  const { createHash } = await import('crypto');
  // store bcrypt hash of secret
  const secretHash = await bcrypt.hash(secret, 10);

  const { rows } = await query(
    `INSERT INTO devices (device_uid, device_secret_hash, plan_bound, user_id, device_name)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, device_uid, plan_bound`,
    [uid, secretHash, plan_bound, user_id, device_name || `Device ${uid}`]
  );
  await audit({ actorType: 'admin', actorId: req.admin.id, action: 'device.provision', entityType: 'device', entityId: rows[0].id, metadata: { user_id, plan_bound } });
  res.status(201).json({ device: rows[0], provisioning: { device_uid: uid, device_secret: secret } });
}));

router.post('/devices/:id/enabled', asyncH(async (req, res) => {
  const enabled = !!req.body?.enabled;
  const { rowCount } = await query(`UPDATE devices SET enabled=$2 WHERE id=$1`, [req.params.id, enabled]);
  if (!rowCount) throw Errors.notFound('Device');
  await audit({ actorType: 'admin', actorId: req.admin.id, action: `device.${enabled ? 'enable' : 'disable'}`, entityType: 'device', entityId: req.params.id });
  res.json({ ok: true });
}));

router.post('/devices/:id/assign', asyncH(async (req, res) => {
  const { user_id } = req.body || {};
  const { rowCount } = await query(`UPDATE devices SET user_id=$2 WHERE id=$1`, [req.params.id, user_id || null]);
  if (!rowCount) throw Errors.notFound('Device');
  await audit({ actorType: 'admin', actorId: req.admin.id, action: 'device.assign', entityType: 'device', entityId: req.params.id, metadata: { user_id } });
  res.json({ ok: true });
}));

router.delete('/devices/:id', asyncH(async (req, res) => {
  const { rowCount } = await query(`DELETE FROM devices WHERE id=$1`, [req.params.id]);
  if (!rowCount) throw Errors.notFound('Device');
  await audit({ actorType: 'admin', actorId: req.admin.id, action: 'device.delete', entityType: 'device', entityId: req.params.id });
  res.json({ ok: true });
}));

// ----- Subscriptions / Renew ------------------------------------------------
router.get('/subscriptions', asyncH(async (_req, res) => {
  const { rows } = await query(
    `SELECT s.*, u.email, u.full_name FROM subscriptions s
       JOIN users u ON u.id=s.user_id
       ORDER BY s.created_at DESC LIMIT 500`
  );
  res.json({ subscriptions: rows });
}));

const renewSchema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(['basic', 'standard', 'premium']),
  subscription_id: z.string().uuid().optional(),
  payment_reference: z.string().max(200).optional(),
  days: z.number().int().min(1).max(3650).optional(),
});
router.post('/subscriptions/renew', validate(renewSchema), asyncH(async (req, res) => {
  const { user_id, plan, subscription_id, payment_reference, days } = req.body;
  const sub = await activateOrRenew({ subscriptionId: subscription_id, adminId: req.admin.id, userId: user_id, planName: plan, paymentReference: payment_reference, days });
  const daysLabel = days || 365;
  await query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES ($1, 'Subscription activated',
             'Your ' || $2 || ' plan is now active for ' || $3 || ' days.',
             'billing')`,
    [user_id, plan, daysLabel]
  );
  res.json({ subscription: sub });
}));

// ----- Payments -------------------------------------------------------------
router.get('/payments', asyncH(async (req, res) => {
  const status = req.query.status;
  const filter = status ? `WHERE p.verification_status=$1` : '';
  const params = status ? [status] : [];
  const { rows } = await query(
    `SELECT p.*, u.email, u.full_name FROM payments p
       JOIN users u ON u.id=p.user_id ${filter}
       ORDER BY p.created_at DESC LIMIT 500`,
    params
  );
  res.json({ payments: rows });
}));

const verifySchema = z.object({
  decision: z.enum(['verified', 'rejected']),
  note: z.string().max(500).optional(),
});
router.post('/payments/:id/verify', validate(verifySchema), asyncH(async (req, res) => {
  const { decision, note } = req.body;
  const result = await tx(async (c) => {
    const { rows } = await c.query(
      `UPDATE payments SET verification_status=$2, verified_by_admin=$3, verified_at=NOW()
        WHERE id=$1 RETURNING *`,
      [req.params.id, decision, req.admin.id]
    );
    const payment = rows[0];
    if (!payment) throw Errors.notFound('Payment');
    let subscription = null;
    if (decision === 'verified') {
      subscription = await activateOrRenew({
        subscriptionId: payment.subscription_id, adminId: req.admin.id, userId: payment.user_id,
        planName: (await c.query(`SELECT plan_name FROM subscriptions WHERE id=$1`, [payment.subscription_id])).rows[0]?.plan_name || 'basic',
        paymentReference: payment.payment_reference,
      });
      await c.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'Payment verified', 'Your payment has been verified and your subscription is now active.', 'billing')`,
        [payment.user_id]
      );
    } else {
      await c.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'Payment rejected', COALESCE($2, 'Your payment could not be verified. Please contact support.'), 'billing')`,
        [payment.user_id, note || null]
      );
    }
    return { payment, subscription };
  });
  await audit({ actorType: 'admin', actorId: req.admin.id, action: `payment.${decision}`, entityType: 'payment', entityId: req.params.id, metadata: { note } });
  res.json(result);
}));

// ----- Premium Requests -----------------------------------------------------
router.get('/premium-requests', asyncH(async (_req, res) => {
  const { rows } = await query(
    `SELECT n.*, u.email, u.full_name, u.phone,
            s.plan_name AS current_plan, s.status AS sub_status, s.end_date
       FROM notifications n
       JOIN users u ON u.id=n.user_id
       LEFT JOIN LATERAL (
         SELECT plan_name, status, end_date FROM subscriptions
          WHERE user_id=n.user_id ORDER BY end_date DESC LIMIT 1
       ) s ON TRUE
      WHERE n.type='premium_request'
      ORDER BY n.created_at DESC LIMIT 200`
  );
  res.json({ requests: rows });
}));

router.post('/premium-requests/:id/dismiss', asyncH(async (req, res) => {
  await query(`UPDATE notifications SET is_read=true WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// ----- Audit + schedules ---------------------------------------------------
router.get('/audit-logs', asyncH(async (_req, res) => {
  const { rows } = await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`);
  res.json({ audit_logs: rows });
}));

router.get('/schedules', asyncH(async (_req, res) => {
  const { rows } = await query(
    `SELECT s.*, u.email, d.device_uid FROM schedules s
       JOIN users u ON u.id=s.user_id
       JOIN devices d ON d.id=s.device_id
      ORDER BY s.created_at DESC LIMIT 500`
  );
  res.json({ schedules: rows });
}));

export default router;
