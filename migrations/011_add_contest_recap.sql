-- Migration 011: Cash-narrated contest recap storage
-- Backs the "Contest Recap" feature (see Design/Contest-Recap-Generation-Spec.md
-- in the mobile repo, and recap.service.js here): from a concluded contest we
-- assemble a deterministic INPUT (recapInput.service.js), have Claude narrate it
-- in Cash's voice, and store the result for an admin to review and publish.
--
-- One row per contest, keyed by contest_id:
--   status         'draft' | 'published'  — kids only ever see 'published'
--   recap_json     the recap OUTPUT object as a JSON string (shape can evolve
--                  without a schema change; see the OUTPUT schema in the spec)
--   model          the model id used to generate it (e.g. 'claude-sonnet-5')
--   generated_at   when the draft was generated
--   published_at   when an admin published it (NULL while draft)
--
-- Kept as its own table (not columns on `contest`) so the recap read path and
-- the large JSON body stay off the hot contest read/list queries.
--
-- Replace `project.dataset` with the real BigQuery project & dataset before
-- running: `bq query --use_legacy_sql=false < 011_add_contest_recap.sql`

CREATE TABLE IF NOT EXISTS `project.dataset.contest_recap` (
  contest_id   STRING   NOT NULL,   -- FK → contest.contest_id (one recap per contest)
  status       STRING   NOT NULL,   -- 'draft' | 'published'
  recap_json   STRING,              -- recap OUTPUT object, JSON-encoded
  model        STRING,              -- generating model id
  generated_at DATETIME,            -- draft generated
  published_at DATETIME,            -- published (NULL while draft)
  created_at   DATETIME NOT NULL,
  updated_at   DATETIME NOT NULL
);
