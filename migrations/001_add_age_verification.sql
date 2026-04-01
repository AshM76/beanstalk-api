-- Migration 001: Add Age Verification Fields
-- Adds DOB and age verification tracking to user_profile table
--
-- Changes:
-- - Replace user_age (DATE) with user_dateOfBirth (DATE) for accurate calculations
-- - Add user_age_verified to track completion status
-- - Add user_age_verification_method to indicate which method was used
-- - Add user_age_verification_timestamp for audit trail
-- - Add user_age_group for age cohort segmentation

ALTER TABLE user_profile
ADD COLUMN user_dateOfBirth DATE,
ADD COLUMN user_age_verified BOOLEAN DEFAULT false,
ADD COLUMN user_age_verification_method STRING,
ADD COLUMN user_age_verification_timestamp DATETIME,
ADD COLUMN user_age_group STRING;

-- Create index on age group for contest matching queries
CREATE INDEX idx_user_age_group ON user_profile (user_age_group);

-- Update description
-- Note: user_age column can be deprecated after data migration from DATE to DATETIME
