import { Errors } from '../utils/http.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(Errors.badRequest('Validation failed', parsed.error.flatten()));
    }
    req[source] = parsed.data;
    next();
  };
}
