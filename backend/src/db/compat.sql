-- compat.sql: additive migrations that run after schema.sql
-- Safe to run multiple times (all statements use IF NOT EXISTS / DO NOTHING).

-- Add read flag to notifications if missing (older schema)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false;

-- Add type column to notifications if missing
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(80);
