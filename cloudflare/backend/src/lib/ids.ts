/** Workers runtime exposes `crypto.randomUUID` globally (no imports needed). */
export const newId = () => crypto.randomUUID();

/** EPT-ABC123-DEF456 style device UID */
export function newDeviceUid(): string {
  const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `EPT-${hex()}-${hex()}`;
}

/** Cryptographically-random secret (48 hex chars) */
export function randomSecret(bytes = 24): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ISO timestamp in UTC (matches SQLite datetime('now') format when stripped of Z) */
export const nowIso = () => new Date().toISOString();
