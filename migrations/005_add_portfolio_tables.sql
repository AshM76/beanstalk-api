-- Migration 005: Add Portfolio Tables
-- Create portfolio, position, and transaction tables for virtual trading

CREATE TABLE IF NOT EXISTS `project.dataset.portfolio` (
  `portfolio_id` STRING NOT NULL,
  `user_id` STRING NOT NULL,
  `portfolio_type` STRING NOT NULL, -- 'main' or 'contest'
  `contest_id` STRING,
  `starting_balance` NUMERIC NOT NULL,
  `current_cash_balance` NUMERIC NOT NULL,
  `total_invested` NUMERIC,
  `total_position_value` NUMERIC,
  `total_portfolio_value` NUMERIC NOT NULL,
  `total_return_amount` NUMERIC,
  `total_return_percent` NUMERIC,
  `daily_return_percent` NUMERIC,
  `highest_portfolio_value` NUMERIC,
  `lowest_portfolio_value` NUMERIC,
  `positions` ARRAY<STRUCT<
    position_id STRING,
    symbol STRING,
    quantity NUMERIC,
    purchase_price NUMERIC,
    purchase_date DATETIME,
    current_price NUMERIC,
    current_value NUMERIC,
    unrealized_gain_loss NUMERIC,
    unrealized_gain_loss_percent NUMERIC,
    updated_at DATETIME
  >>,
  `position_count` INTEGER,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `last_price_update` DATETIME
)
PARTITION BY DATE(created_at)
CLUSTER BY user_id;

CREATE TABLE IF NOT EXISTS `project.dataset.portfolio_transaction` (
  `transaction_id` STRING NOT NULL,
  `portfolio_id` STRING NOT NULL,
  `user_id` STRING NOT NULL,
  `transaction_type` STRING NOT NULL, -- 'buy', 'sell', 'dividend', 'deposit', 'withdrawal'
  `symbol` STRING,
  `quantity` NUMERIC,
  `price` NUMERIC,
  `amount` NUMERIC NOT NULL,
  `contest_id` STRING,
  `contest_entry_fee` NUMERIC,
  `prize_amount` NUMERIC,
  `transaction_date` DATETIME NOT NULL,
  `settlement_date` DATETIME,
  `created_at` DATETIME NOT NULL,
  `status` STRING, -- 'pending', 'completed', 'failed'
  `notes` STRING
)
PARTITION BY DATE(transaction_date)
CLUSTER BY user_id, portfolio_id;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON `project.dataset.portfolio` (user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_contest_id ON `project.dataset.portfolio` (contest_id);
CREATE INDEX IF NOT EXISTS idx_transaction_portfolio_id ON `project.dataset.portfolio_transaction` (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transaction_user_id ON `project.dataset.portfolio_transaction` (user_id);
