-- Migration 012: Personal (per-kid) contest mini-recaps
-- Backs phase 4 of the Cash contest recap (see recap.service.js): a short,
-- private, encouraging recap for each kid who was in a concluded contest.
--
-- Generated LAZILY — only when a kid opens their recap, and only once the
-- group recap for that contest is PUBLISHED (so an admin has approved the tone
-- and the personal recap inherits that gate). Cached thereafter. One row per
-- (contest, user).
--
--   recap_json   the personal recap OUTPUT (JSON-encoded); shape can evolve
--   model        the generating model id
--   generated_at when it was generated
--
-- Personal recaps are private to each kid; there is no `status` column because
-- they are not separately published — the published group recap is the gate.
--
-- Replace `project.dataset` with the real BigQuery project & dataset before
-- running: `bq query --use_legacy_sql=false < 012_add_contest_recap_personal.sql`

CREATE TABLE IF NOT EXISTS `project.dataset.contest_recap_personal` (
  contest_id   STRING   NOT NULL,   -- FK → contest.contest_id
  user_id      STRING   NOT NULL,   -- FK → users.user_id (the kid this recap is for)
  recap_json   STRING,              -- personal recap OUTPUT, JSON-encoded
  model        STRING,              -- generating model id
  generated_at DATETIME,
  created_at   DATETIME NOT NULL,
  updated_at   DATETIME NOT NULL
);
