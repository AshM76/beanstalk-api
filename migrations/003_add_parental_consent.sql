-- Migration 003: Add Parental Consent Fields
-- Adds parental consent workflow fields for users under 18
--
-- Changes:
-- - Add parent name for record keeping
-- - Add parent email (required for minors)
-- - Add parent_consent boolean to track acceptance
-- - Add parent_consent_timestamp for audit trail
-- - Add parent_email_verified to track email confirmation
-- - Add parent_verification_token (JWT-based, temporary)
-- - Add parent_verification_token_expires for token expiry tracking (7-day default)

ALTER TABLE user_profile
ADD COLUMN user_parent_name STRING,
ADD COLUMN user_parent_email STRING,
ADD COLUMN user_parent_consent BOOLEAN,
ADD COLUMN user_parent_consent_timestamp DATETIME,
ADD COLUMN user_parent_email_verified BOOLEAN DEFAULT false,
ADD COLUMN user_parent_verification_token STRING,
ADD COLUMN user_parent_verification_token_expires DATETIME;

-- Create index for pending parent verification lookups
CREATE INDEX idx_parent_verification_token ON user_profile (user_parent_verification_token);
CREATE INDEX idx_minor_pending_consent ON user_profile (user_age_group, user_parent_email_verified)
WHERE user_age_group IN ('middle_school', 'high_school') AND user_parent_email_verified = false;

-- Create parental_consent_log table for audit trail
CREATE TABLE IF NOT EXISTS parental_consent_log (
  log_id STRING NOT NULL,
  user_id STRING NOT NULL,
  parent_email STRING,
  action STRING,  -- 'initiated', 'email_sent', 'verified', 'declined', 'token_expired'
  action_timestamp DATETIME,
  PRIMARY KEY (log_id)
);

-- Index for quick lookups by user
CREATE INDEX idx_parental_consent_log_user ON parental_consent_log (user_id);
