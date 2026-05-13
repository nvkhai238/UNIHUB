-- V4: Add workshop PDF and AI summary metadata.
-- Run this SQL manually on Supabase dashboard if Flyway is not active.

ALTER TABLE workshops ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS ai_summary_status VARCHAR(20) DEFAULT 'NONE';

UPDATE workshops
SET ai_summary_status = 'NONE'
WHERE ai_summary_status IS NULL;
