-- compat.sql: additive migrations — safe to run multiple times.

-- Ensure heartbeat_at exists in device_status_logs (older deployments may lack it)
ALTER TABLE device_status_logs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure notifications has the type column
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(80) NOT NULL DEFAULT 'info';

-- Ensure notifications has is_read (schema uses is_read, not read)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Contact requests (pre-signup enquiries from landing page)
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
