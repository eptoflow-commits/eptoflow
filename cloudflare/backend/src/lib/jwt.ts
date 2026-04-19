/**
 * JWT helpers built on `jose` — works in the Workers runtime (Web Crypto).
 * We sign with HS256.
 */
import { SignJWT, jwtVerify } from 'jose';

const enc = new TextEncoder();

export type Audience = 'user' | 'admin' | 'device';

/** Parse a "7d" / "30m" style duration into seconds. */
function parseDuration(v: string): number {
  const m = /^(\d+)([smhd])$/.exec(v);
  if (!m) return 7 * 24 * 3600;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  return unit === 's' ? n : unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : n * 86400;
}

export async function signJWT(
  payload: Record<string, any>,
  secret: string,
  expiresIn: string,
  audience: Audience,
) {
  const secs = parseDuration(expiresIn);
  return new SignJWT({ ...payload, role: audience })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + secs)
    .sign(enc.encode(secret));
}

export async function verifyJWT(token: string, secret: string, audience: Audience) {
  const { payload } = await jwtVerify(token, enc.encode(secret));
  if (payload.role !== audience) throw new Error('wrong audience');
  return payload as any;
}
