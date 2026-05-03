import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

import { config } from './config/index.js';
import { pool } from './db/pool.js';
import { notFound, errorHandler } from './middleware/error.js';
import { startCronJobs } from './jobs/index.js';

/** Auto-seed default admin if none exists — runs once on startup. */
async function seedAdminIfNeeded() {
  try {
    const { rowCount } = await pool.query('SELECT 1 FROM admins LIMIT 1');
    if (rowCount > 0) return; // already seeded
    const hash = await bcrypt.hash(config.admin.defaultPassword, 10);
    await pool.query(
      `INSERT INTO admins (full_name, email, password_hash)
       VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
      ['Platform Admin', config.admin.defaultEmail, hash],
    );
    console.log(`[seed] admin created → ${config.admin.defaultEmail}`);
  } catch (e) {
    console.warn('[seed] auto-seed skipped:', e.message);
  }
}

import authRoutes from './routes/auth.routes.js';
import devicesRoutes from './routes/devices.routes.js';
import deviceApiRoutes from './routes/deviceApi.routes.js';
import schedulesRoutes from './routes/schedules.routes.js';
import subscriptionsRoutes from './routes/subscriptions.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Global soft rate limit (per-IP). Stricter limits are applied per-route.
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, env: config.env, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Public / user routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/notifications', notificationsRoutes);

// ESP32 device-facing API
app.use('/api/device', deviceApiRoutes);

// Admin
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, async () => {
  console.log(`[eptoflow] backend listening on :${config.port} (${config.env})`);
  console.log(`[cors] allowed origins: ${config.allowedOrigins.join(', ')}`);
  await seedAdminIfNeeded();
  startCronJobs();
});

process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
process.on('SIGINT',  async () => { await pool.end(); process.exit(0); });
