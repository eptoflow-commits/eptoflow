import type { Context, Next, MiddlewareHandler } from 'hono';
import { Err } from './errors';
import { verifyJWT, type Audience } from './jwt';
import type { Env } from '../env';

export type AppCtx = {
  Bindings: Env;
  Variables: {
    user?: { id: string; email: string };
    admin?: { id: string; email: string };
    device?: { id: string; uid: string };
    subscription?: any;
  };
};

function getBearer(c: Context): string | null {
  const h = c.req.header('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export const authUser: MiddlewareHandler<AppCtx> = async (c, next) => {
  const t = getBearer(c);
  if (!t) throw Err.unauthorized('Missing token');
  try {
    const p = await verifyJWT(t, c.env.JWT_SECRET, 'user');
    c.set('user', { id: p.sub, email: p.email });
    await next();
  } catch { throw Err.unauthorized('Invalid token'); }
};

export const authAdmin: MiddlewareHandler<AppCtx> = async (c, next) => {
  const t = getBearer(c);
  if (!t) throw Err.unauthorized('Missing token');
  try {
    const p = await verifyJWT(t, c.env.ADMIN_JWT_SECRET, 'admin');
    c.set('admin', { id: p.sub, email: p.email });
    await next();
  } catch { throw Err.unauthorized('Invalid admin token'); }
};

export const authDevice: MiddlewareHandler<AppCtx> = async (c, next) => {
  const t = getBearer(c);
  if (!t) throw Err.unauthorized('Missing device token');
  try {
    const p = await verifyJWT(t, c.env.DEVICE_JWT_SECRET, 'device');
    c.set('device', { id: p.sub, uid: p.uid });
    await next();
  } catch { throw Err.unauthorized('Invalid device token'); }
};

/** Loads latest subscription for user into c.get('subscription') */
export function loadSubscription(
  { requireActive = false }: { requireActive?: boolean } = {}
): MiddlewareHandler<AppCtx> {
  return async (c, next) => {
    const u = c.get('user');
    if (!u) throw Err.unauthorized();
    const row: any = await c.env.DB.prepare(
      `SELECT * FROM subscriptions WHERE user_id=?1 ORDER BY end_date DESC LIMIT 1`
    ).bind(u.id).first();
    const nowMs = Date.now();
    const endMs = row ? Date.parse(row.end_date.replace(' ', 'T') + 'Z') : 0;
    const isActive = !!(row && row.status === 'active' && endMs > nowMs);
    c.set('subscription', row ? {
      ...row,
      isActive,
      daysRemaining: Math.max(0, Math.ceil((endMs - nowMs) / 86_400_000)),
    } : { isActive: false, plan_name: null, daysRemaining: 0, status: 'none' });
    if (requireActive && !isActive) throw Err.subscriptionInactive();
    await next();
  };
}

export function requirePlan(...plans: Array<'basic' | 'premium'>): MiddlewareHandler<AppCtx> {
  return async (c, next) => {
    const s = c.get('subscription');
    if (!s?.isActive) throw Err.subscriptionInactive();
    if (!plans.includes(s.plan_name)) throw Err.planRestricted(`Requires plan: ${plans.join(' or ')}`);
    await next();
  };
}
