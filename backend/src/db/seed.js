import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { config } from '../config/index.js';

async function seed() {
  const { defaultEmail, defaultPassword } = config.admin;
  const hash = await bcrypt.hash(defaultPassword, 10);

  const res = await pool.query(
    `INSERT INTO admins (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email`,
    ['Default Admin', defaultEmail, hash]
  );

  if (res.rowCount === 0) {
    console.log(`[seed] admin ${defaultEmail} already exists`);
  } else {
    console.log(`[seed] created admin ${defaultEmail} / ${defaultPassword}`);
  }
  await pool.end();
}

seed().catch(err => { console.error('[seed] failed:', err); process.exit(1); });
