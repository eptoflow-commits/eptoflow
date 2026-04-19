import type { Context } from 'hono';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status; this.code = code; this.details = details;
  }
}

export const Err = {
  badRequest:   (m = 'Bad request', d?: unknown) => new ApiError(400, 'BAD_REQUEST', m, d),
  unauthorized: (m = 'Unauthorized') => new ApiError(401, 'UNAUTHORIZED', m),
  forbidden:    (m = 'Forbidden')    => new ApiError(403, 'FORBIDDEN', m),
  notFound:     (m = 'Not found')    => new ApiError(404, 'NOT_FOUND', m),
  conflict:     (m = 'Conflict')     => new ApiError(409, 'CONFLICT', m),
  planRestricted:      (m = 'Feature not available on your plan') =>
    new ApiError(403, 'PLAN_RESTRICTED', m),
  subscriptionInactive:(m = 'Subscription inactive or expired') =>
    new ApiError(402, 'SUBSCRIPTION_INACTIVE', m),
};

export function sendError(c: Context, e: unknown) {
  if (e instanceof ApiError) {
    return c.json(
      { error: { code: e.code, message: e.message, details: e.details ?? null } },
      e.status as any,
    );
  }
  console.error('[unhandled]', e);
  return c.json({ error: { code: 'SERVER_ERROR', message: 'Internal error' } }, 500);
}
