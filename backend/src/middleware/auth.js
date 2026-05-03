import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { Errors } from '../utils/http.js';
import { query } from '../db/pool.js';

function getBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

export function signUserToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: 'user' },
    config.jwt.userSecret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: 'admin' },
    config.jwt.adminSecret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export function signDeviceToken(device) {
  return jwt.sign(
    { sub: device.id, uid: device.device_uid, role: 'device' },
    config.jwt.deviceSecret,
    { expiresIn: config.jwt.deviceExpiresIn }
  );
}

export function authUser(req, _res, next) {
  const token = getBearer(req);
  if (!token) return next(Errors.unauthorized('Missing token'));
  try {
    const payload = jwt.verify(token, config.jwt.userSecret);
    if (payload.role !== 'user') throw new Error('wrong audience');
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return next(Errors.unauthorized('Invalid token'));
  }
}

export function authAdmin(req, _res, next) {
  const token = getBearer(req);
  if (!token) return next(Errors.unauthorized('Missing token'));
  try {
    const payload = jwt.verify(token, config.jwt.adminSecret);
    if (payload.role !== 'admin') throw new Error('wrong audience');
    req.admin = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return next(Errors.unauthorized('Invalid admin token'));
  }
}

export function authDevice(req, _res, next) {
  const token = getBearer(req);
  if (!token) return next(Errors.unauthorized('Missing device token'));
  try {
    const payload = jwt.verify(token, config.jwt.deviceSecret);
    if (payload.role !== 'device') throw new Error('wrong audience');
    req.device = { id: payload.sub, uid: payload.uid };
    return next();
  } catch {
    return next(Errors.unauthorized('Invalid device token'));
  }
}

/**
 * Loads the active subscription + plan into req.subscription for the current user.
 * If `requireActive` is true, blocks the request when subscription is not active.
 */
export function loadSubscription({ requireActive = false } = {}) {
  return async (req, _res, next) => {
    if (!req.user) return next(Errors.unauthorized());
    try {
      const { rows } = await query(
        `SELECT * FROM subscriptions
          WHERE user_id = $1
          ORDER BY end_date DESC
          LIMIT 1`,
        [req.user.id]
      );
      const sub = rows[0] || null;
      const isActive = !!(sub && sub.status === 'active' && new Date(sub.end_date) > new Date());
      const daysRemaining = sub
        ? Math.max(0, Math.ceil((new Date(sub.end_date) - new Date()) / 86_400_000))
        : 0;
      req.subscription = sub
        ? { ...sub, isActive, daysRemaining }
        : { isActive: false, plan_name: null, daysRemaining: 0, status: 'none' };

      if (requireActive && !req.subscription.isActive) {
        return next(Errors.subscriptionInactive());
      }
      next();
    } catch (e) {
      console.error('[loadSubscription] error:', e.message);
      // Don't block the request — just set empty subscription
      req.subscription = { isActive: false, plan_name: null, daysRemaining: 0, status: 'none' };
      next();
    }
  };
}

/**
 * Requires the user's active plan to be one of the allowed list.
 */
export function requirePlan(...plans) {
  return (req, _res, next) => {
    if (!req.subscription?.isActive) return next(Errors.subscriptionInactive());
    if (!plans.includes(req.subscription.plan_name)) {
      return next(Errors.planRestricted(`Requires plan: ${plans.join(' or ')}`));
    }
    next();
  };
}
