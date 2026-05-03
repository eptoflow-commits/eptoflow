import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const compat = fs.readFileSync(path.join(__dirname, 'compat.sql'), 'utf8');
  console.log('[migrate] applying schema.sql ...');
  await pool.query(sql);
  console.log('[migrate] applying compat.sql ...');
  await pool.query(compat);
  console.log('[migrate] done');
  await pool.end();
}

run().catch(err => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
