-- Migration 002: Add Demographics Fields
-- Adds demographic and profiling fields to user_profile table for user segmentation and analytics
--
-- Changes:
-- - Add location fields: city, state, country, zipCode
-- - Add education level (enum: middle_school, high_school, some_college, college, graduate, other)
-- - Add income bracket (enum: under_25k, 25k_50k, 50k_100k, 100k_250k, 250k_plus, prefer_not_to_say)
-- - Add primary interest for contest/feature matching
-- - Add risk tolerance for investment/trading recommendations

ALTER TABLE user_profile
ADD COLUMN user_city STRING,
ADD COLUMN user_state STRING,
ADD COLUMN user_country STRING,
ADD COLUMN user_zipCode STRING,
ADD COLUMN user_education_level STRING,
ADD COLUMN user_income_bracket STRING,
ADD COLUMN user_primary_interest STRING,
ADD COLUMN user_risk_tolerance STRING;

-- Create indexes for demographic filtering
CREATE INDEX idx_user_education_level ON user_profile (user_education_level);
CREATE INDEX idx_user_country ON user_profile (user_country);
CREATE INDEX idx_user_risk_tolerance ON user_profile (user_risk_tolerance);
