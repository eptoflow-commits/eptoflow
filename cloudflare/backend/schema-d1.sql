-- ===========================================================================
-- Eptoflow schema for Cloudflare D1 (SQLite).
-- Boolean is INTEGER(0/1); UUIDs are TEXT (generated in code).
-- Timestamps are TEXT ISO strings (UTC).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'user',
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS admins (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'admin',
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                         TEXT PRIMARY KEY,
  user_id                    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name                  TEXT NOT NULL,
  amount                     REAL NOT NULL,
  start_date                 TEXT NOT NULL DEFAULT (datetime('now')),
  end_date                   TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'pending',
  manually_verified_by_admin TEXT REFERENCES admins(id),
  renewed_at                 TEXT,
  payment_reference          TEXT,
  notes                      TEXT,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end    ON subscriptions(end_date);

CREATE TABLE IF NOT EXISTS devices (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT REFERENCES users(id) ON DELETE SET NULL,
  device_uid         TEXT NOT NULL UNIQUE,
  device_name        TEXT NOT NULL DEFAULT 'Eptoflow Device',
  device_secret_hash TEXT NOT NULL,
  plan_bound         TEXT NOT NULL DEFAULT 'basic',
  firmware_version   TEXT,
  status             TEXT NOT NULL DEFAULT 'offline',
  last_seen_at       TEXT,
  last_known_ip      TEXT,
  enabled            INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_uid  ON devices(device_uid);

CREATE TABLE IF NOT EXISTS device_status_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id      TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  relay1_state   INTEGER,
  valve1_state   INTEGER,
  valve2_state   INTEGER,
  valve3_state   INTEGER,
  moisture_value INTEGER,
  wifi_rssi      INTEGER,
  heartbeat_at   TEXT NOT NULL DEFAULT (datetime('now')),
  raw_payload    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_status_device ON device_status_logs(device_id, heartbeat_at DESC);

CREATE TABLE IF NOT EXISTS commands (
  id               TEXT PRIMARY KEY,
  device_id        TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  command_type     TEXT NOT NULL,
  payload          TEXT NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'pending',
  source           TEXT NOT NULL DEFAULT 'manual',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at     TEXT,
  executed_at      TEXT,
  acknowledged_at  TEXT,
  error_message    TEXT
);
CREATE INDEX IF NOT EXISTS idx_commands_device_status ON commands(device_id, status);
CREATE INDEX IF NOT EXISTS idx_commands_created       ON commands(created_at);

CREATE TABLE IF NOT EXISTS schedules (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id        TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  zone_or_output   TEXT NOT NULL,
  days_of_week     TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',  -- CSV of 1..7 (Mon..Sun)
  start_time       TEXT NOT NULL,                          -- 'HH:MM'
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 3600),
  enabled          INTEGER NOT NULL DEFAULT 1,
  last_run_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schedules_device  ON schedules(device_id);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);

CREATE TABLE IF NOT EXISTS payments (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id        TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount                 REAL NOT NULL,
  payment_mode           TEXT NOT NULL DEFAULT 'manual',
  payment_reference      TEXT,
  screenshot_url_or_note TEXT,
  verification_status    TEXT NOT NULL DEFAULT 'pending',
  verified_by_admin      TEXT REFERENCES admins(id),
  verified_at            TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_user   ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(verification_status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type  TEXT NOT NULL,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  metadata    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS voice_logs (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id        TEXT REFERENCES devices(id) ON DELETE SET NULL,
  command_text     TEXT NOT NULL,
  parsed_command   TEXT,
  execution_status TEXT NOT NULL DEFAULT 'pending',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_voice_user ON voice_logs(user_id, created_at DESC);

-- Custom zone names per device (users rename valve1/2/3 and relay1)
CREATE TABLE IF NOT EXISTS device_zones (
  id         TEXT PRIMARY KEY,
  device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  zone_key   TEXT NOT NULL,   -- 'valve1' | 'valve2' | 'valve3' | 'relay1'
  zone_name  TEXT NOT NULL,   -- user-chosen name e.g. "Tomato Bed"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(device_id, zone_key)
);
CREATE INDEX IF NOT EXISTS idx_device_zones_device ON device_zones(device_id);
