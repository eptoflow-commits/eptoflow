-- compat.sql: additive migrations — safe to run multiple times.

-- Ensure heartbeat_at exists in device_status_logs (older deployments may lack it)
ALTER TABLE device_status_logs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure notifications has the type column
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(80) NOT NULL DEFAULT 'info';

-- Ensure notifications has is_read (schema uses is_read, not read)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
