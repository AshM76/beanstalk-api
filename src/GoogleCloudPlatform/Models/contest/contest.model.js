/**
 * Contest Model Schema
 * Represents investment contests for age-matched cohorts
 */

const prizeSchema = [
  { name: 'rank_from', type: 'INTEGER', mode: 'REQUIRED' },
  { name: 'rank_to', type: 'INTEGER', mode: 'REQUIRED' },
  { name: 'prize_description', type: 'STRING', mode: 'REQUIRED' },
  { name: 'prize_type', type: 'STRING', mode: 'REQUIRED' }, // 'badge' | 'certificate' | 'virtual_currency' | 'real_prize'
  { name: 'prize_value', type: 'STRING', mode: 'REQUIRED' }, // e.g., "$50", "Gold Badge", "1000 points"
]

const contestSchema = [
  // ── Core Contest Info ──────────────────────────────────────────
  { name: 'contest_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'creator_id', type: 'STRING', mode: 'REQUIRED' }, // Admin or contest manager
  { name: 'name', type: 'STRING', mode: 'REQUIRED' },
  { name: 'description', type: 'STRING' },

  // ── Age Groups & Eligibility ───────────────────────────────────
  { name: 'age_groups', type: 'STRING', mode: 'REPEATED' }, // Array of eligible age groups
  { name: 'min_age', type: 'INTEGER' }, // Minimum participant age
  { name: 'contest_difficulty_level', type: 'STRING' }, // 'beginner' | 'intermediate' | 'advanced'

  // ── Dates ──────────────────────────────────────────────────────
  { name: 'start_date', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'end_date', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'registration_deadline', type: 'DATETIME' }, // Last date to join contest

  // ── Contest Rules ──────────────────────────────────────────────
  { name: 'rules', type: 'STRING' }, // Markdown formatted rules
  { name: 'starting_balance', type: 'NUMERIC', mode: 'REQUIRED' }, // Initial portfolio value for all participants
  { name: 'allow_shorting', type: 'BOOLEAN', mode: 'REQUIRED', defaultValue: false },
  { name: 'allow_margin', type: 'BOOLEAN', mode: 'REQUIRED', defaultValue: false },
  { name: 'max_position_size_percent', type: 'NUMERIC' }, // Max % of portfolio in single position
  { name: 'allowed_asset_classes', type: 'STRING', mode: 'REPEATED' }, // e.g., ['stocks', 'etfs', 'options']

  // ── Participation Limits ───────────────────────────────────────
  { name: 'max_participants', type: 'INTEGER' },
  { name: 'current_participants', type: 'INTEGER', mode: 'REQUIRED', defaultValue: 0 },
  { name: 'min_participants', type: 'INTEGER' }, // Minimum to run contest

  // ── Prizes ────────────────────────────────────────────────────
  { name: 'prizes', type: 'RECORD', mode: 'REPEATED', fields: prizeSchema },
  { name: 'total_prize_pool', type: 'NUMERIC' }, // Total value of all prizes

  // ── Status ────────────────────────────────────────────────────
  { name: 'status', type: 'STRING', mode: 'REQUIRED' }, // 'draft' | 'active' | 'concluded' | 'cancelled'
  { name: 'visibility', type: 'STRING', mode: 'REQUIRED', defaultValue: 'public' }, // 'public' | 'private' | 'invite_only'

  // ── Results & Timestamps ───────────────────────────────────────
  { name: 'winners_announced', type: 'BOOLEAN', defaultValue: false },
  { name: 'concluded_at', type: 'DATETIME' },
  { name: 'created_at', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'updated_at', type: 'DATETIME', mode: 'REQUIRED' },
]

const participantSchema = [
  // ── Core Participation ────────────────────────────────────────
  { name: 'participation_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'contest_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },

  // ── Snapshot at Entry Time ────────────────────────────────────
  { name: 'age_group_at_entry', type: 'STRING', mode: 'REQUIRED' }, // Snapshot: user's age group when they joined
  { name: 'portfolio_snapshot_id', type: 'STRING', mode: 'REQUIRED' }, // Separate contest portfolio

  // ── Status ────────────────────────────────────────────────────
  { name: 'status', type: 'STRING', mode: 'REQUIRED' }, // 'active' | 'withdrew' | 'disqualified'
  { name: 'withdrawal_reason', type: 'STRING' }, // Why they withdrew/were disqualified

  // ── Results ────────────────────────────────────────────────────
  { name: 'final_rank', type: 'INTEGER' },
  { name: 'final_portfolio_value', type: 'NUMERIC' },
  { name: 'final_return_percent', type: 'NUMERIC' },
  { name: 'final_return_amount', type: 'NUMERIC' },
  { name: 'prize_awarded', type: 'STRING' }, // Prize description they won

  // ── Timestamps ────────────────────────────────────────────────
  { name: 'entry_date', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'created_at', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'updated_at', type: 'DATETIME', mode: 'REQUIRED' },
]

const leaderboardSchema = [
  // ── Core Leaderboard ───────────────────────────────────────────
  { name: 'leaderboard_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'contest_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'age_group', type: 'STRING', mode: 'REQUIRED' }, // Which age group this leaderboard is for

  // ── Rankings (REPEATED) ────────────────────────────────────────
  { name: 'rankings', type: 'RECORD', mode: 'REPEATED', fields: [
    { name: 'rank', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'username', type: 'STRING', mode: 'REQUIRED' },
    { name: 'portfolio_value', type: 'NUMERIC', mode: 'REQUIRED' },
    { name: 'return_percent', type: 'NUMERIC', mode: 'REQUIRED' },
    { name: 'position_count', type: 'INTEGER' },
    { name: 'best_performing_position', type: 'STRING' }, // Symbol of best trade
    { name: 'best_position_return_percent', type: 'NUMERIC' },
    { name: 'last_trade_date', type: 'DATETIME' },
  ]},

  // ── Metadata ───────────────────────────────────────────────────
  { name: 'total_participants', type: 'INTEGER' },
  { name: 'updated_at', type: 'DATETIME', mode: 'REQUIRED' },
]

module.exports = {
  contestSchema,
  participantSchema,
  leaderboardSchema,
  prizeSchema,
}
