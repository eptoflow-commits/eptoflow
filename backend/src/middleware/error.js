import { ApiError } from '../utils/http.js';

export function notFound(_req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details || null },
    });
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal error' } });
}
