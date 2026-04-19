import 'dotenv/config';

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return v;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    userSecret: required('JWT_SECRET'),
    adminSecret: required('ADMIN_JWT_SECRET'),
    deviceSecret: required('DEVICE_JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    deviceExpiresIn: process.env.DEVICE_JWT_EXPIRES_IN || '30d',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',').map(s => s.trim()).filter(Boolean),
  admin: {
    defaultEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@eptoflow.local',
    defaultPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe!Admin123',
  },
  heartbeat: {
    offlineSeconds: parseInt(process.env.HEARTBEAT_OFFLINE_SECONDS || '120', 10),
  },
  subscription: {
    durationDays: parseInt(process.env.SUBSCRIPTION_DAYS || '30', 10),
    plans: {
      basic:   { name: 'basic',   amount: 2.99 },
      premium: { name: 'premium', amount: 3.99 },
    },
  },
};
