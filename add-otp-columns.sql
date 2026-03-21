-- =============================================================
-- QUICK FIX: Add otp column to email and password reset tables
-- Run this directly against your PostgreSQL database
-- =============================================================

-- Add otp column to email_verifications (safe, skips if already exists)
ALTER TABLE "email_verifications" ADD COLUMN IF NOT EXISTS "otp" varchar(6);

-- Add otp column to password_reset_tokens (safe, skips if already exists)
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "otp" varchar(6);

-- Verify it worked
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'email_verifications';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'password_reset_tokens';
