-- Migration 009: Add password-reset columns to the Users table
-- Backs the POST /api/auth/password/forgot + /reset flow (see
-- auth.controller.js and user.service.js). Mirrors the reset fields the
-- in-memory store keeps directly on each user record (see _memory_store.js).
--
-- We store only a bcrypt hash of the 6-digit code (never the code itself),
-- plus a short expiry and an attempt counter for brute-force resistance.
--
-- Replace `project.dataset` with the real BigQuery project & dataset before
-- running: `bq query --use_legacy_sql=false < 009_add_password_reset.sql`

ALTER TABLE `project.dataset.users`
  ADD COLUMN IF NOT EXISTS `password_reset_code_hash` STRING,   -- bcrypt hash of the 6-digit code
  ADD COLUMN IF NOT EXISTS `password_reset_expires_at` DATETIME, -- UTC; code invalid after this
  ADD COLUMN IF NOT EXISTS `password_reset_attempts` INT64;      -- failed verifications since issue
