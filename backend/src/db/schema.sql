-- ===========================================================================
-- Eptoflow database schema (PostgreSQL 14+)
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- users
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(160) NOT NULL UNIQUE,
    phone           VARCHAR(24),
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'user',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- --------------------------------------------------------------------------
-- admins
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(160) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'admin',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- subscriptions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_name                   VARCHAR(20) NOT NULL,   -- 'basic' | 'premium'
    amount                      NUMERIC(10,2) NOT NULL,
    start_date                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date                    TIMESTAMPTZ NOT NULL,
    status                      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|active|expired|cancelled
    manually_verified_by_admin  UUID REFERENCES admins(id),
    renewed_at                  TIMESTAMPTZ,
    payment_reference           TEXT,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end ON subscriptions(end_date);

-- --------------------------------------------------------------------------
-- devices
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
    device_uid         VARCHAR(64) NOT NULL UNIQUE,
    device_name        VARCHAR(120) NOT NULL DEFAULT 'Eptoflow Device',
    device_secret_hash TEXT NOT NULL,
    plan_bound         VARCHAR(20) NOT NULL DEFAULT 'basic',  -- basic|premium
    firmware_version   VARCHAR(40),
    status             VARCHAR(20) NOT NULL DEFAULT 'offline', -- online|offline|disabled
    last_seen_at       TIMESTAMPTZ,
    last_known_ip      VARCHAR(64),
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_uid  ON devices(device_uid);

-- --------------------------------------------------------------------------
-- device_status_logs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_status_logs (
    id             BIGSERIAL PRIMARY KEY,
    device_id      UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    relay1_state   BOOLEAN,
    valve1_state   BOOLEAN,
    valve2_state   BOOLEAN,
    valve3_state   BOOLEAN,
    moisture_value INTEGER,
    wifi_rssi      INTEGER,
    heartbeat_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_payload    JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_device ON device_status_logs(device_id, heartbeat_at DESC);

-- --------------------------------------------------------------------------
-- commands (queue)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commands (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id        UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    command_type     VARCHAR(40) NOT NULL,          -- valve_on, valve_off, relay_on, relay_off, water_for, stop_all
    payload          JSONB NOT NULL DEFAULT '{}',    -- { target: 'valve1', duration: 120 }
    status           VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|delivered|executed|failed|expired
    source           VARCHAR(20) NOT NULL DEFAULT 'manual',  -- manual|voice|schedule|automation
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at     TIMESTAMPTZ,
    executed_at      TIMESTAMPTZ,
    acknowledged_at  TIMESTAMPTZ,
    error_message    TEXT
);
CREATE INDEX IF NOT EXISTS idx_commands_device_status ON commands(device_id, status);
CREATE INDEX IF NOT EXISTS idx_commands_created ON commands(created_at);

-- --------------------------------------------------------------------------
-- schedules
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id        UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    zone_or_output   VARCHAR(20) NOT NULL, -- valve1|valve2|valve3|relay1
    days_of_week     SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7]::SMALLINT[], -- 1=Mon ... 7=Sun
    start_time       TIME NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 3600),
    enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedules_device ON schedules(device_id);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);

-- --------------------------------------------------------------------------
-- payments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id        UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount                 NUMERIC(10,2) NOT NULL,
    payment_mode           VARCHAR(40) NOT NULL DEFAULT 'manual',
    payment_reference      TEXT,
    screenshot_url_or_note TEXT,
    verification_status    VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|verified|rejected
    verified_by_admin      UUID REFERENCES admins(id),
    verified_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(verification_status);

-- --------------------------------------------------------------------------
-- audit_logs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_type  VARCHAR(20) NOT NULL,   -- user|admin|device|system
    actor_id    UUID,
    action      VARCHAR(80) NOT NULL,
    entity_type VARCHAR(40),
    entity_id   UUID,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- --------------------------------------------------------------------------
-- notifications
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(160) NOT NULL,
    message    TEXT NOT NULL,
    type       VARCHAR(40) NOT NULL DEFAULT 'info', -- info|warning|success|error|billing|device
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- --------------------------------------------------------------------------
-- voice_logs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id        UUID REFERENCES devices(id) ON DELETE SET NULL,
    command_text     TEXT NOT NULL,
    parsed_command   JSONB,
    execution_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voice_user ON voice_logs(user_id, created_at DESC);

-- --------------------------------------------------------------------------
-- contact_requests (pre-signup enquiries — no user_id required)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name   VARCHAR(120) NOT NULL,
    email       VARCHAR(160) NOT NULL,
    phone       VARCHAR(24),
    plan        VARCHAR(20) NOT NULL DEFAULT 'basic',  -- basic|premium|custom
    message     TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'new',    -- new|contacted|done
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status, created_at DESC);

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['users','subscriptions','devices','schedules']) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated ON %I;', t, t);
        EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
    END LOOP;
END$$;

-- Custom zone names per device
CREATE TABLE IF NOT EXISTS device_zones (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  zone_key   VARCHAR(20) NOT NULL,
  zone_name  VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, zone_key)
);
CREATE INDEX IF NOT EXISTS idx_device_zones_device ON device_zones(device_id);

-- Trigger to auto-update updated_at
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_device_zones_updated ON device_zones;
  CREATE TRIGGER trg_device_zones_updated
    BEFORE UPDATE ON device_zones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END$$;

-- ============================================================================
-- Relay licensing (premium add-on relays 6, 7, 8)
-- ============================================================================
CREATE TABLE IF NOT EXISTS relay_licenses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  relay_key    VARCHAR(10) NOT NULL,
  activated    BOOLEAN     NOT NULL DEFAULT false,
  activated_by UUID,
  activated_at TIMESTAMPTZ,
  amount_paid  NUMERIC(10,2) DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, relay_key)
);
CREATE INDEX IF NOT EXISTS idx_relay_lic_device ON relay_licenses(device_id);

-- ============================================================================
-- Per-valve automation rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  valve_key       VARCHAR(10) NOT NULL,
  enabled         BOOLEAN     NOT NULL DEFAULT true,
  mode            VARCHAR(10) NOT NULL DEFAULT 'auto',
  on_moisture_lt  NUMERIC(5,2),
  on_temp_gt      NUMERIC(5,2),
  on_logic        VARCHAR(3)  DEFAULT 'AND',
  off_moisture_gt NUMERIC(5,2),
  off_temp_lt     NUMERIC(5,2),
  off_logic       VARCHAR(3)  DEFAULT 'AND',
  schedule_start  VARCHAR(5),
  schedule_end    VARCHAR(5),
  max_duration_s  INTEGER     NOT NULL DEFAULT 1800,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, valve_key)
);
CREATE INDEX IF NOT EXISTS idx_auto_rules_device ON automation_rules(device_id);

-- ============================================================================
-- Sensor readings
-- ============================================================================
CREATE TABLE IF NOT EXISTS sensor_readings (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    UUID    NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sensor_addr  INTEGER NOT NULL DEFAULT 1,
  moisture_pct NUMERIC(5,2),
  temp_c       NUMERIC(5,2),
  raw_moisture INTEGER,
  raw_temp     INTEGER,
  read_ok      BOOLEAN NOT NULL DEFAULT true,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sensor_device_time ON sensor_readings(device_id, recorded_at DESC);

-- ============================================================================
-- Sensor alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS sensor_alerts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  alert_type   VARCHAR(30) NOT NULL,
  valve_key    VARCHAR(10),
  threshold    NUMERIC(5,2),
  actual_value NUMERIC(5,2),
  resolved     BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_device ON sensor_alerts(device_id, resolved, created_at DESC);
