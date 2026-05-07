-- Add password_hash column to users table (not in original schema, added for auth)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';
