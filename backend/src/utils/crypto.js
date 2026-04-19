import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function randomDeviceUid() {
  // EPT-XXXXX-XXXXX (uppercase hex)
  const a = crypto.randomBytes(3).toString('hex').toUpperCase();
  const b = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `EPT-${a}-${b}`;
}

export function hashSecret(plain) {
  return bcrypt.hash(plain, 10);
}

export function compareSecret(plain, hash) {
  return bcrypt.compare(plain, hash);
}
