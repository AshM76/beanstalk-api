-- Migration 004: Add EULA & Consent Tracking
-- Implements version-controlled EULA management with full consent audit trail
--
-- Changes:
-- - Add user_consents as REPEATED RECORD to track all consent acceptances
-- - Add account_status and account_status_reason for account lifecycle management
-- - Add user_account_verified_at for completion of verification process
-- - Create eula_documents table for version-controlled EULA storage
-- - Create user_consent_log table for full audit trail

-- Add fields to user_profile
ALTER TABLE user_profile
ADD COLUMN user_consents ARRAY<STRUCT<
  consent_id STRING,
  consent_type STRING,
  consent_version STRING,
  consent_accepted BOOLEAN,
  consent_accepted_at DATETIME,
  consent_accepted_from_ip STRING,
  consent_accepted_device_info STRING,
  user_type_at_consent STRING
>>,
ADD COLUMN user_account_status STRING DEFAULT 'pending_verification',
ADD COLUMN user_account_status_reason STRING,
ADD COLUMN user_account_verified_at DATETIME,
ADD COLUMN user_agreementAccepted BOOLEAN DEFAULT false;

-- Create eula_documents table for version-controlled EULA documents
CREATE TABLE IF NOT EXISTS eula_documents (
  eula_id STRING NOT NULL,
  eula_type STRING NOT NULL,
  user_types_applicable ARRAY<STRING>,
  age_groups_applicable ARRAY<STRING>,
  version STRING NOT NULL,
  major_version INTEGER,
  minor_version INTEGER,
  patch_version INTEGER,
  content_html STRING,
  content_plain_text STRING,
  effective_date DATE,
  superseded_date DATE,
  is_current_version BOOLEAN DEFAULT true,
  requires_acceptance BOOLEAN DEFAULT true,
  created_at DATETIME NOT NULL,
  created_by_admin_id STRING,
  change_summary STRING,
  PRIMARY KEY (eula_id)
);

-- Create user_consent_log table for audit trail
CREATE TABLE IF NOT EXISTS user_consent_log (
  log_id STRING NOT NULL,
  user_id STRING NOT NULL,
  eula_id STRING NOT NULL,
  acceptance_timestamp DATETIME,
  acceptance_ip_address STRING,
  acceptance_device_fingerprint STRING,
  acceptance_user_agent STRING,
  acceptance_status STRING,
  parent_verification_token_used BOOLEAN DEFAULT false,
  notes STRING,
  PRIMARY KEY (log_id)
);

-- Create indexes for common queries
CREATE INDEX idx_eula_type_current ON eula_documents (eula_type, is_current_version);
CREATE INDEX idx_eula_effective_date ON eula_documents (effective_date);
CREATE INDEX idx_consent_log_user ON user_consent_log (user_id);
CREATE INDEX idx_consent_log_eula ON user_consent_log (eula_id);
CREATE INDEX idx_user_account_status ON user_profile (user_account_status);

-- Add index for user_consents array searches
CREATE INDEX idx_user_consents_type ON user_profile (user_consents.consent_type);
