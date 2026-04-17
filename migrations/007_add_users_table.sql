-- Migration 007: Add Users Table
-- Stores authenticated user accounts for the Beanstalk API. Mirrors the shape
-- of the in-memory store's user records (see _memory_store.js), plus a
-- `role` column for admin/contest_manager permission checks in controllers.
--
-- Replace `project.dataset` with the real BigQuery project & dataset before
-- running: `bq query --use_legacy_sql=false < 007_add_users_table.sql`

CREATE TABLE IF NOT EXISTS `project.dataset.users` (
  `user_id` STRING NOT NULL,
  `name` STRING NOT NULL,
  `email` STRING NOT NULL,              -- stored lowercased; uniqueness enforced in service
  `password_hash` STRING NOT NULL,      -- bcrypt, cost 10
  `avatar_url` STRING,
  `role` STRING NOT NULL DEFAULT 'user', -- 'user', 'admin', 'contest_manager'
  `age_group` STRING,                    -- 'high_school', 'college', 'adults' (set during onboarding)
  `date_of_birth` DATE,
  `account_status` STRING NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'deleted'
  `email_verified` BOOLEAN DEFAULT FALSE,
  `last_login_at` DATETIME,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY email, role;

-- Email uniqueness is enforced at the service layer (getUserByEmail before
-- insert). BigQuery does not support unique constraints.
