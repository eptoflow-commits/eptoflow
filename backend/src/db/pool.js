import pg from 'pg';
import { config } from '../config/index.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Enable SSL if DATABASE_URL ends with ?sslmode=require (Neon/Supabase/Railway)
  ssl: config.databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[pg] unexpected pool error:', err);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
