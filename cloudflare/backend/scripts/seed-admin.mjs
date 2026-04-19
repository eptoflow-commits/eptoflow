#!/usr/bin/env node
/**
 * Generates a seed.sql file containing an INSERT OR IGNORE for the default
 * admin user. Run this ONCE locally before you apply the seed to D1:
 *
 *    DEFAULT_ADMIN_EMAIL=admin@eptoflow.local \
 *    DEFAULT_ADMIN_PASSWORD="ChangeMe!123" \
 *    node scripts/seed-admin.mjs > seed.sql
 *
 *    npx wrangler d1 execute eptoflow --remote --file=seed.sql
 *    # (use --local for the local dev DB)
 *
 * Default credentials (override with env vars):
 *   email    : admin@eptoflow.local
 *   password : ChangeMe!123
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const email    = process.env.DEFAULT_ADMIN_EMAIL    || 'admin@eptoflow.local';
const password = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe!123';
const fullName = process.env.DEFAULT_ADMIN_NAME     || 'Platform Admin';

const id   = randomUUID();
const hash = await bcrypt.hash(password, 10);

// Escape single quotes for SQL literals.
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

process.stdout.write(`-- Eptoflow default-admin seed (generated ${new Date().toISOString()})
INSERT OR IGNORE INTO admins (id, full_name, email, password_hash, role, status)
VALUES (${q(id)}, ${q(fullName)}, ${q(email)}, ${q(hash)}, 'admin', 'active');

-- Credentials (CHANGE AFTER FIRST LOGIN):
--   email:    ${email}
--   password: ${password}
`);
