-- Migration 006: Add Contest Tables
-- Create contest, participant, and leaderboard tables for investment challenges

CREATE TABLE IF NOT EXISTS `project.dataset.contest` (
  `contest_id` STRING NOT NULL,
  `creator_id` STRING NOT NULL,
  `name` STRING NOT NULL,
  `description` STRING,
  `age_groups` ARRAY<STRING> NOT NULL,
  `min_age` INTEGER,
  `contest_difficulty_level` STRING, -- 'beginner', 'intermediate', 'advanced'
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NOT NULL,
  `registration_deadline` DATETIME,
  `rules` STRING,
  `starting_balance` NUMERIC NOT NULL,
  `allow_shorting` BOOLEAN DEFAULT FALSE,
  `allow_margin` BOOLEAN DEFAULT FALSE,
  `max_position_size_percent` NUMERIC,
  `allowed_asset_classes` ARRAY<STRING>,
  `max_participants` INTEGER,
  `current_participants` INTEGER DEFAULT 0,
  `min_participants` INTEGER,
  `prizes` ARRAY<STRUCT<
    rank_from INTEGER,
    rank_to INTEGER,
    prize_description STRING,
    prize_type STRING,
    prize_value STRING
  >>,
  `total_prize_pool` NUMERIC,
  `status` STRING NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'concluded', 'cancelled'
  `visibility` STRING DEFAULT 'public', -- 'public', 'private', 'invite_only'
  `winners_announced` BOOLEAN DEFAULT FALSE,
  `concluded_at` DATETIME,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY creator_id, status;

CREATE TABLE IF NOT EXISTS `project.dataset.contest_participant` (
  `participation_id` STRING NOT NULL,
  `contest_id` STRING NOT NULL,
  `user_id` STRING NOT NULL,
  `age_group_at_entry` STRING NOT NULL,
  `portfolio_snapshot_id` STRING NOT NULL,
  `status` STRING NOT NULL DEFAULT 'active', -- 'active', 'withdrew', 'disqualified'
  `withdrawal_reason` STRING,
  `final_rank` INTEGER,
  `final_portfolio_value` NUMERIC,
  `final_return_percent` NUMERIC,
  `final_return_amount` NUMERIC,
  `prize_awarded` STRING,
  `entry_date` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY contest_id, user_id;

CREATE TABLE IF NOT EXISTS `project.dataset.contest_leaderboard` (
  `leaderboard_id` STRING NOT NULL,
  `contest_id` STRING NOT NULL,
  `age_group` STRING NOT NULL,
  `rankings` ARRAY<STRUCT<
    rank INTEGER,
    user_id STRING,
    username STRING,
    portfolio_value NUMERIC,
    return_percent NUMERIC,
    position_count INTEGER,
    best_performing_position STRING,
    best_position_return_percent NUMERIC,
    last_trade_date DATETIME
  >>,
  `total_participants` INTEGER,
  `updated_at` DATETIME NOT NULL
)
PARTITION BY DATE(updated_at)
CLUSTER BY contest_id, age_group;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contest_status ON `project.dataset.contest` (status);
CREATE INDEX IF NOT EXISTS idx_contest_creator ON `project.dataset.contest` (creator_id);
CREATE INDEX IF NOT EXISTS idx_participant_contest ON `project.dataset.contest_participant` (contest_id);
CREATE INDEX IF NOT EXISTS idx_participant_user ON `project.dataset.contest_participant` (user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_contest ON `project.dataset.contest_leaderboard` (contest_id);
