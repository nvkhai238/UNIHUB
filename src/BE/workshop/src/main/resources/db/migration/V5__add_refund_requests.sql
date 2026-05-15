-- V5: Add refund request storage for cancelled paid workshops.
-- Run this SQL manually on Supabase dashboard if Flyway is not active.

CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    bank_account_name VARCHAR(255) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    proof_url TEXT NOT NULL,
    proof_note TEXT,
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    processed_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_processed ON refund_requests(processed);
CREATE INDEX IF NOT EXISTS idx_refund_requests_registration ON refund_requests(registration_id);
