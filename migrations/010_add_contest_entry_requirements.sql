-- Migration 010: Add learning-gate entry requirements to the Contest table
-- Backs the "gate contest entry on learning progress" feature: an admin can
-- require a minimum XP total and/or a set of specific lessons (passed) before
-- a user may join a contest. See contest.controller.js + contest.service.js;
-- the mobile app enforces the gate client-side against local lesson progress,
-- and these columns are the server-side source of truth for the rule itself.
--
-- Both are optional and combinable:
--   entry_min_xp = NULL or 0  AND  entry_required_lessons = NULL/[]  → no gate
--   entry_min_xp = 300                                               → XP gate
--   entry_required_lessons = ['l5','l6']                             → lesson gate
--   both set                                                         → must meet both
--
-- Lesson ids match the mobile lesson catalog (l1..l26, see lessons_page.dart).
-- Existing contests get NULL for both columns and remain open (no requirement).
--
-- Replace `project.dataset` with the real BigQuery project & dataset before
-- running: `bq query --use_legacy_sql=false < 010_add_contest_entry_requirements.sql`

ALTER TABLE `project.dataset.contest`
  ADD COLUMN IF NOT EXISTS `entry_min_xp` INT64,                    -- min total XP required to join (NULL/0 = none)
  ADD COLUMN IF NOT EXISTS `entry_required_lessons` ARRAY<STRING>;  -- lesson ids that must be passed (empty = none)
