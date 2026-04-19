export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  badRequest: (msg = 'Bad request', details) => new ApiError(400, 'BAD_REQUEST', msg, details),
  unauthorized: (msg = 'Unauthorized') => new ApiError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'Forbidden') => new ApiError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Not found') => new ApiError(404, 'NOT_FOUND', msg),
  conflict: (msg = 'Conflict') => new ApiError(409, 'CONFLICT', msg),
  planRestricted: (msg = 'Feature not available on your plan') =>
    new ApiError(403, 'PLAN_RESTRICTED', msg),
  subscriptionInactive: (msg = 'Subscription inactive or expired') =>
    new ApiError(402, 'SUBSCRIPTION_INACTIVE', msg),
  server: (msg = 'Internal error') => new ApiError(500, 'SERVER_ERROR', msg),
};

export function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
