export interface Env {
  DB: D1Database;

  // Secrets (wrangler secret put ...)
  JWT_SECRET: string;
  ADMIN_JWT_SECRET: string;
  DEVICE_JWT_SECRET: string;
  DEFAULT_ADMIN_PASSWORD: string;

  // Vars
  ALLOWED_ORIGINS: string;
  DEFAULT_ADMIN_EMAIL: string;
  HEARTBEAT_OFFLINE_SECONDS: string;
  SUBSCRIPTION_DAYS: string;
  JWT_EXPIRES_IN: string;
  DEVICE_JWT_EXPIRES_IN: string;

  // Voice / smart-assistant integrations (optional — set via wrangler secret)
  /** Your Alexa Skill ID — used for future request-signature verification */
  ALEXA_SKILL_ID?: string;
}

export function cfg(env: Env) {
  return {
    heartbeatOfflineSeconds: parseInt(env.HEARTBEAT_OFFLINE_SECONDS || '120', 10),
    subscriptionDays: parseInt(env.SUBSCRIPTION_DAYS || '30', 10),
    plans: {
      basic:   { name: 'basic',   amount: 2.99 },
      premium: { name: 'premium', amount: 3.99 },
    } as const,
    allowedOrigins: (env.ALLOWED_ORIGINS || 'http://localhost:3000')
      .split(',').map((s) => s.trim()).filter(Boolean),
  };
}
