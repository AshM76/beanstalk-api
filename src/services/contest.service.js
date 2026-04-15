/**
 * Contest Service
 * Handles contest operations: creation, participation, rankings, results
 *
 * Persistence: Google BigQuery.
 *   Tables (see migrations/006_add_contest_tables.sql):
 *     - `${dataset}.contest`              (one row per contest)
 *     - `${dataset}.contest_participant`  (one row per user-in-contest; links to portfolio_snapshot_id)
 *     - `${dataset}.contest_leaderboard`  (materialized rankings; written by concludeContest)
 *
 * Uses named parameter queries throughout. REPEATED fields (`age_groups`,
 * `allowed_asset_classes`, `prizes`) are parameter-bound as ARRAY types rather
 * than string-interpolated to avoid injection and quoting bugs.
 */

const { v4: uuidv4 } = require('uuid')
const { BigQuery } = require('@google-cloud/bigquery')
const portfolioService = require('./portfolio.service')

const {
  BEANSTALK_GCP_BIGQUERY_PROJECTID,
  BEANSTALK_GCP_BIGQUERY_DATASETID,
} = process.env

const keyFilename = './src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json'
const bigquery = new BigQuery({
  projectId: BEANSTALK_GCP_BIGQUERY_PROJECTID,
  keyFilename,
})

const DATASET = BEANSTALK_GCP_BIGQUERY_DATASETID
const CONTEST_TABLE = `\`${BEANSTALK_GCP_BIGQUERY_PROJECTID}.${DATASET}.contest\``
const PARTICIPANT_TABLE = `\`${BEANSTALK_GCP_BIGQUERY_PROJECTID}.${DATASET}.contest_participant\``
const PORTFOLIO_TABLE = `\`${BEANSTALK_GCP_BIGQUERY_PROJECTID}.${DATASET}.portfolio\``

function toBqDatetime(value) {
  if (value === null || value === undefined) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace('T', ' ').replace('Z', '')
}

function unwrapDatetime(v) {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object' && v.value) return new Date(v.value.replace(' ', 'T') + 'Z')
  return new Date(v)
}

function toNum(v) {
  return v === null || v === undefined ? null : Number(v)
}

// Inflate a BQ row back into the shape the service layer expects
function rowToContest(row) {
  if (!row) return null
  return {
    contest_id: row.contest_id,
    creator_id: row.creator_id,
    name: row.name,
    description: row.description,
    age_groups: row.age_groups || [],
    min_age: row.min_age,
    contest_difficulty_level: row.contest_difficulty_level,
    start_date: unwrapDatetime(row.start_date),
    end_date: unwrapDatetime(row.end_date),
    registration_deadline: unwrapDatetime(row.registration_deadline),
    rules: row.rules,
    starting_balance: toNum(row.starting_balance),
    allow_shorting: Boolean(row.allow_shorting),
    allow_margin: Boolean(row.allow_margin),
    max_position_size_percent: toNum(row.max_position_size_percent),
    allowed_asset_classes: row.allowed_asset_classes || [],
    max_participants: row.max_participants,
    current_participants: row.current_participants ?? 0,
    min_participants: row.min_participants,
    prizes: (row.prizes || []).map(p => ({
      rank_from: p.rank_from,
      rank_to: p.rank_to,
      prize_description: p.prize_description,
      prize_type: p.prize_type,
      prize_value: p.prize_value,
    })),
    total_prize_pool: toNum(row.total_prize_pool),
    status: row.status,
    visibility: row.visibility,
    winners_announced: Boolean(row.winners_announced),
    concluded_at: unwrapDatetime(row.concluded_at),
    created_at: unwrapDatetime(row.created_at),
    updated_at: unwrapDatetime(row.updated_at),
  }
}

const PRIZE_STRUCT_TYPE = {
  type: 'ARRAY',
  arrayType: {
    type: 'STRUCT',
    structTypes: [
      { name: 'rank_from', type: { type: 'INT64' } },
      { name: 'rank_to', type: { type: 'INT64' } },
      { name: 'prize_description', type: { type: 'STRING' } },
      { name: 'prize_type', type: { type: 'STRING' } },
      { name: 'prize_value', type: { type: 'STRING' } },
    ],
  },
}

async function runQuery(query, params = {}, types = {}) {
  const [rows] = await bigquery.query({
    query,
    params,
    types,
    location: 'US',
    parameterMode: 'named',
  })
  return rows
}

/**
 * Create a new contest
 * @param {string} creatorId - Admin/Contest manager ID
 * @param {object} contestData - Contest details
 * @returns {Promise<object>} Created contest
 */
async function createContest(creatorId, contestData) {
  const contest = {
    contest_id: uuidv4(),
    creator_id: creatorId,
    name: contestData.name,
    description: contestData.description,
    age_groups: contestData.age_groups || ['high_school', 'college', 'adults'],
    min_age: contestData.min_age || 13,
    contest_difficulty_level: contestData.contest_difficulty_level || 'beginner',
    start_date: contestData.start_date,
    end_date: contestData.end_date,
    registration_deadline: contestData.registration_deadline || contestData.start_date,
    rules: contestData.rules,
    starting_balance: contestData.starting_balance || 10000,
    allow_shorting: contestData.allow_shorting || false,
    allow_margin: contestData.allow_margin || false,
    max_position_size_percent: contestData.max_position_size_percent || 25,
    allowed_asset_classes: contestData.allowed_asset_classes || ['stocks', 'etfs'],
    max_participants: contestData.max_participants || null,
    current_participants: 0,
    min_participants: contestData.min_participants || 2,
    prizes: contestData.prizes || [],
    total_prize_pool: calculateTotalPrizePool(contestData.prizes || []),
    status: 'draft',
    visibility: contestData.visibility || 'public',
    winners_announced: false,
    concluded_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  }

  try {
    await saveContestToDatabase(contest)
    return contest
  } catch (error) {
    console.error('Error creating contest:', error)
    throw error
  }
}

/**
 * Get contest by ID
 * @param {string} contestId - Contest ID
 * @returns {Promise<object>} Contest object
 */
async function getContest(contestId) {
  try {
    const contest = await fetchContestFromDatabase(contestId)
    return contest
  } catch (error) {
    console.error('Error fetching contest:', error)
    throw error
  }
}

/**
 * List contests with filters
 * @param {object} filters - age_groups, status, visibility, difficulty
 * @param {object} options - pagination (limit, offset)
 * @returns {Promise<array>} Array of contests
 */
async function listContests(filters = {}, options = { limit: 20, offset: 0 }) {
  try {
    const contests = await fetchContestsFromDatabase(filters, options)
    return contests
  } catch (error) {
    console.error('Error listing contests:', error)
    throw error
  }
}

/**
 * Add participant to contest
 * @param {string} contestId - Contest ID
 * @param {string} userId - User ID
 * @param {string} ageGroup - User's age group
 * @returns {Promise<object>} Participation record
 */
async function joinContest(contestId, userId, ageGroup) {
  const contest = await getContest(contestId)

  if (!contest) {
    throw new Error('Contest not found')
  }

  // Check if contest is active and open for registration
  const now = new Date()
  if (now > new Date(contest.registration_deadline)) {
    throw new Error('Contest registration has closed')
  }

  if (contest.status !== 'active' && contest.status !== 'draft') {
    throw new Error('Contest is not accepting participants')
  }

  // Check if age group is eligible
  if (!contest.age_groups.includes(ageGroup)) {
    throw new Error(`Age group '${ageGroup}' is not eligible for this contest`)
  }

  // Check max participants
  if (contest.max_participants && contest.current_participants >= contest.max_participants) {
    throw new Error('Contest is full')
  }

  // Check if user already joined
  const existing = await checkUserInContest(contestId, userId)
  if (existing) {
    throw new Error('User already joined this contest')
  }

  // Create contest portfolio for this user
  const contestPortfolio = await portfolioService.createPortfolio(
    userId,
    contest.starting_balance,
    'contest',
    contestId
  )

  // Create participation record
  const participation = {
    participation_id: uuidv4(),
    contest_id: contestId,
    user_id: userId,
    age_group_at_entry: ageGroup,
    portfolio_snapshot_id: contestPortfolio.portfolio_id,
    status: 'active',
    withdrawal_reason: null,
    final_rank: null,
    final_portfolio_value: null,
    final_return_percent: null,
    final_return_amount: null,
    prize_awarded: null,
    entry_date: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  }

  try {
    // Save participation
    await saveParticipationToDatabase(participation)

    // Update contest participant count
    contest.current_participants++
    if (contest.current_participants >= contest.min_participants && contest.status === 'draft') {
      contest.status = 'active'
    }
    await updateContestInDatabase(contest)

    return participation
  } catch (error) {
    console.error('Error adding participant to contest:', error)
    throw error
  }
}

/**
 * Get leaderboard for a contest
 * @param {string} contestId - Contest ID
 * @param {string} ageGroup - Filter by age group (optional)
 * @returns {Promise<object>} Leaderboard with rankings
 */
async function getLeaderboard(contestId, ageGroup = null) {
  const contest = await getContest(contestId)

  if (!contest) {
    throw new Error('Contest not found')
  }

  try {
    const participants = await getContestParticipants(contestId, ageGroup)

    // Sort by portfolio value descending
    participants.sort((a, b) => {
      const valueA = a.portfolio_snapshot?.total_portfolio_value || 0
      const valueB = b.portfolio_snapshot?.total_portfolio_value || 0
      return valueB - valueA
    })

    // Assign ranks and calculate metrics
    const rankings = participants.map((p, index) => {
      const portfolio = p.portfolio_snapshot
      return {
        rank: index + 1,
        user_id: p.user_id,
        username: p.username,
        portfolio_value: portfolio?.total_portfolio_value || 0,
        return_percent: portfolio?.total_return_percent || 0,
        position_count: portfolio?.position_count || 0,
        best_performing_position: findBestPosition(portfolio?.positions),
        best_position_return_percent: findBestPositionReturn(portfolio?.positions),
        last_trade_date: findLastTradeDate(portfolio?.positions),
      }
    })

    // Group by age group if requested
    const leaderboards = {}

    if (ageGroup) {
      leaderboards[ageGroup] = {
        leaderboard_id: uuidv4(),
        contest_id: contestId,
        age_group: ageGroup,
        rankings: rankings,
        total_participants: rankings.length,
        updated_at: new Date(),
      }
    } else {
      // Create separate leaderboard for each age group
      contest.age_groups.forEach(group => {
        const groupRankings = rankings.filter(r => {
          const participant = participants.find(p => p.user_id === r.user_id)
          return participant?.age_group_at_entry === group
        })

        leaderboards[group] = {
          leaderboard_id: uuidv4(),
          contest_id: contestId,
          age_group: group,
          rankings: groupRankings,
          total_participants: groupRankings.length,
          updated_at: new Date(),
        }
      })
    }

    return leaderboards
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    throw error
  }
}

/**
 * Conclude a contest and assign prizes
 * @param {string} contestId - Contest ID
 * @returns {Promise<object>} Results with winners and prizes
 */
async function concludeContest(contestId) {
  const contest = await getContest(contestId)

  if (!contest) {
    throw new Error('Contest not found')
  }

  if (contest.status === 'concluded') {
    throw new Error('Contest has already concluded')
  }

  try {
    const leaderboards = await getLeaderboard(contestId)
    const results = {}

    // Process each age group separately
    for (const [ageGroup, leaderboard] of Object.entries(leaderboards)) {
      const winners = []

      // Assign prizes based on rankings
      leaderboard.rankings.forEach(ranking => {
        const prize = contest.prizes.find(
          p => ranking.rank >= p.rank_from && ranking.rank <= p.rank_to
        )

        if (prize) {
          winners.push({
            rank: ranking.rank,
            user_id: ranking.user_id,
            username: ranking.username,
            portfolio_value: ranking.portfolio_value,
            return_percent: ranking.return_percent,
            prize: prize.prize_description,
            prize_type: prize.prize_type,
            prize_value: prize.prize_value,
          })

          // Update participation with prize
          updateParticipantWithPrize(ranking.user_id, contestId, ranking.rank, prize.prize_description)
        }
      })

      results[ageGroup] = winners
    }

    // Update contest status
    contest.status = 'concluded'
    contest.winners_announced = true
    contest.concluded_at = new Date()
    await updateContestInDatabase(contest)

    return {
      contest_id: contestId,
      concluded_at: contest.concluded_at,
      results: results,
    }
  } catch (error) {
    console.error('Error concluding contest:', error)
    throw error
  }
}

/**
 * Calculate prize pool total
 */
function calculateTotalPrizePool(prizes) {
  return prizes.reduce((total, prize) => {
    // Try to extract numeric value from prize_value string
    const match = prize.prize_value?.match(/\$?([\d,]+)/)
    const value = match ? parseFloat(match[1].replace(/,/g, '')) : 0
    return total + value
  }, 0)
}

/**
 * Find best performing position in portfolio
 */
function findBestPosition(positions) {
  if (!positions || positions.length === 0) return null

  let best = positions[0]
  for (const pos of positions) {
    if ((pos.unrealized_gain_loss_percent || 0) > (best.unrealized_gain_loss_percent || 0)) {
      best = pos
    }
  }

  return best.symbol
}

/**
 * Find best position return percentage
 */
function findBestPositionReturn(positions) {
  if (!positions || positions.length === 0) return 0

  return Math.max(...positions.map(p => p.unrealized_gain_loss_percent || 0))
}

/**
 * Find date of last trade
 */
function findLastTradeDate(positions) {
  if (!positions || positions.length === 0) return null

  return Math.max(...positions.map(p => new Date(p.updated_at).getTime()))
}

// ─────────────────────────────────────────────────────────────
// BigQuery persistence layer
// ─────────────────────────────────────────────────────────────

async function saveContestToDatabase(contest) {
  const query = `
    INSERT INTO ${CONTEST_TABLE} (
      contest_id, creator_id, name, description,
      age_groups, min_age, contest_difficulty_level,
      start_date, end_date, registration_deadline,
      rules, starting_balance,
      allow_shorting, allow_margin,
      max_position_size_percent, allowed_asset_classes,
      max_participants, current_participants, min_participants,
      prizes, total_prize_pool,
      status, visibility, winners_announced,
      concluded_at, created_at, updated_at
    ) VALUES (
      @contest_id, @creator_id, @name, @description,
      @age_groups, @min_age, @contest_difficulty_level,
      DATETIME(@start_date), DATETIME(@end_date),
      IF(@registration_deadline IS NULL, NULL, DATETIME(@registration_deadline)),
      @rules, @starting_balance,
      @allow_shorting, @allow_margin,
      @max_position_size_percent, @allowed_asset_classes,
      @max_participants, @current_participants, @min_participants,
      @prizes, @total_prize_pool,
      @status, @visibility, @winners_announced,
      IF(@concluded_at IS NULL, NULL, DATETIME(@concluded_at)),
      DATETIME(@created_at), DATETIME(@updated_at)
    )
  `
  const params = {
    contest_id: contest.contest_id,
    creator_id: contest.creator_id,
    name: contest.name,
    description: contest.description || null,
    age_groups: contest.age_groups,
    min_age: contest.min_age ?? null,
    contest_difficulty_level: contest.contest_difficulty_level || null,
    start_date: toBqDatetime(contest.start_date),
    end_date: toBqDatetime(contest.end_date),
    registration_deadline: toBqDatetime(contest.registration_deadline),
    rules: contest.rules || null,
    starting_balance: contest.starting_balance,
    allow_shorting: contest.allow_shorting,
    allow_margin: contest.allow_margin,
    max_position_size_percent: contest.max_position_size_percent ?? null,
    allowed_asset_classes: contest.allowed_asset_classes || [],
    max_participants: contest.max_participants ?? null,
    current_participants: contest.current_participants ?? 0,
    min_participants: contest.min_participants ?? null,
    prizes: contest.prizes || [],
    total_prize_pool: contest.total_prize_pool ?? 0,
    status: contest.status,
    visibility: contest.visibility,
    winners_announced: contest.winners_announced,
    concluded_at: toBqDatetime(contest.concluded_at),
    created_at: toBqDatetime(contest.created_at),
    updated_at: toBqDatetime(contest.updated_at),
  }
  const types = {
    description: 'STRING',
    contest_difficulty_level: 'STRING',
    registration_deadline: 'STRING',
    rules: 'STRING',
    max_position_size_percent: 'NUMERIC',
    max_participants: 'INT64',
    min_participants: 'INT64',
    concluded_at: 'STRING',
    age_groups: ['STRING'],
    allowed_asset_classes: ['STRING'],
    prizes: PRIZE_STRUCT_TYPE,
  }
  await runQuery(query, params, types)
  return contest
}

async function fetchContestFromDatabase(contestId) {
  const query = `
    SELECT *
    FROM ${CONTEST_TABLE}
    WHERE contest_id = @contest_id
    LIMIT 1
  `
  const rows = await runQuery(query, { contest_id: contestId })
  return rows.length > 0 ? rowToContest(rows[0]) : null
}

async function fetchContestsFromDatabase(filters = {}, options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 200)
  const offset = Math.max(parseInt(options.offset, 10) || 0, 0)

  const wheres = []
  const params = { limit, offset }
  const types = { limit: 'INT64', offset: 'INT64' }

  if (filters.status) {
    wheres.push('status = @status')
    params.status = filters.status
  }
  if (filters.visibility) {
    wheres.push('visibility = @visibility')
    params.visibility = filters.visibility
  }
  if (filters.difficulty) {
    wheres.push('contest_difficulty_level = @difficulty')
    params.difficulty = filters.difficulty
  }
  if (filters.age_groups && filters.age_groups.length) {
    // EXISTS check: any requested age_group present in contest.age_groups
    wheres.push('EXISTS (SELECT 1 FROM UNNEST(age_groups) ag WHERE ag IN UNNEST(@age_groups))')
    params.age_groups = filters.age_groups
    types.age_groups = ['STRING']
  }
  if (filters.creator_id) {
    wheres.push('creator_id = @creator_id')
    params.creator_id = filters.creator_id
  }

  const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''
  const query = `
    SELECT *
    FROM ${CONTEST_TABLE}
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT @limit OFFSET @offset
  `
  const rows = await runQuery(query, params, types)
  return rows.map(rowToContest)
}

async function checkUserInContest(contestId, userId) {
  const query = `
    SELECT participation_id
    FROM ${PARTICIPANT_TABLE}
    WHERE contest_id = @contest_id AND user_id = @user_id AND status != 'withdrew'
    LIMIT 1
  `
  const rows = await runQuery(query, { contest_id: contestId, user_id: userId })
  return rows.length > 0
}

async function saveParticipationToDatabase(participation) {
  const query = `
    INSERT INTO ${PARTICIPANT_TABLE} (
      participation_id, contest_id, user_id,
      age_group_at_entry, portfolio_snapshot_id,
      status, withdrawal_reason,
      final_rank, final_portfolio_value, final_return_percent, final_return_amount,
      prize_awarded,
      entry_date, created_at, updated_at
    ) VALUES (
      @participation_id, @contest_id, @user_id,
      @age_group_at_entry, @portfolio_snapshot_id,
      @status, @withdrawal_reason,
      @final_rank, @final_portfolio_value, @final_return_percent, @final_return_amount,
      @prize_awarded,
      DATETIME(@entry_date), DATETIME(@created_at), DATETIME(@updated_at)
    )
  `
  const params = {
    participation_id: participation.participation_id,
    contest_id: participation.contest_id,
    user_id: participation.user_id,
    age_group_at_entry: participation.age_group_at_entry,
    portfolio_snapshot_id: participation.portfolio_snapshot_id,
    status: participation.status || 'active',
    withdrawal_reason: participation.withdrawal_reason || null,
    final_rank: participation.final_rank ?? null,
    final_portfolio_value: participation.final_portfolio_value ?? null,
    final_return_percent: participation.final_return_percent ?? null,
    final_return_amount: participation.final_return_amount ?? null,
    prize_awarded: participation.prize_awarded || null,
    entry_date: toBqDatetime(participation.entry_date),
    created_at: toBqDatetime(participation.created_at),
    updated_at: toBqDatetime(participation.updated_at),
  }
  const types = {
    withdrawal_reason: 'STRING',
    final_rank: 'INT64',
    final_portfolio_value: 'NUMERIC',
    final_return_percent: 'NUMERIC',
    final_return_amount: 'NUMERIC',
    prize_awarded: 'STRING',
  }
  await runQuery(query, params, types)
  return participation
}

async function updateContestInDatabase(contest) {
  const query = `
    UPDATE ${CONTEST_TABLE}
    SET
      name                      = @name,
      description               = @description,
      age_groups                = @age_groups,
      min_age                   = @min_age,
      contest_difficulty_level  = @contest_difficulty_level,
      start_date                = DATETIME(@start_date),
      end_date                  = DATETIME(@end_date),
      registration_deadline     = IF(@registration_deadline IS NULL, NULL, DATETIME(@registration_deadline)),
      rules                     = @rules,
      starting_balance          = @starting_balance,
      allow_shorting            = @allow_shorting,
      allow_margin              = @allow_margin,
      max_position_size_percent = @max_position_size_percent,
      allowed_asset_classes     = @allowed_asset_classes,
      max_participants          = @max_participants,
      current_participants      = @current_participants,
      min_participants          = @min_participants,
      prizes                    = @prizes,
      total_prize_pool          = @total_prize_pool,
      status                    = @status,
      visibility                = @visibility,
      winners_announced         = @winners_announced,
      concluded_at              = IF(@concluded_at IS NULL, NULL, DATETIME(@concluded_at)),
      updated_at                = DATETIME(@updated_at)
    WHERE contest_id = @contest_id
  `
  const params = {
    contest_id: contest.contest_id,
    name: contest.name,
    description: contest.description || null,
    age_groups: contest.age_groups,
    min_age: contest.min_age ?? null,
    contest_difficulty_level: contest.contest_difficulty_level || null,
    start_date: toBqDatetime(contest.start_date),
    end_date: toBqDatetime(contest.end_date),
    registration_deadline: toBqDatetime(contest.registration_deadline),
    rules: contest.rules || null,
    starting_balance: contest.starting_balance,
    allow_shorting: contest.allow_shorting,
    allow_margin: contest.allow_margin,
    max_position_size_percent: contest.max_position_size_percent ?? null,
    allowed_asset_classes: contest.allowed_asset_classes || [],
    max_participants: contest.max_participants ?? null,
    current_participants: contest.current_participants ?? 0,
    min_participants: contest.min_participants ?? null,
    prizes: contest.prizes || [],
    total_prize_pool: contest.total_prize_pool ?? 0,
    status: contest.status,
    visibility: contest.visibility,
    winners_announced: contest.winners_announced,
    concluded_at: toBqDatetime(contest.concluded_at),
    updated_at: toBqDatetime(new Date()),
  }
  const types = {
    description: 'STRING',
    contest_difficulty_level: 'STRING',
    registration_deadline: 'STRING',
    rules: 'STRING',
    max_position_size_percent: 'NUMERIC',
    max_participants: 'INT64',
    min_participants: 'INT64',
    concluded_at: 'STRING',
    age_groups: ['STRING'],
    allowed_asset_classes: ['STRING'],
    prizes: PRIZE_STRUCT_TYPE,
  }
  await runQuery(query, params, types)
  return contest
}

// Fetches participants JOINed with their linked portfolio snapshot, so the
// leaderboard code in getLeaderboard() has the portfolio data it needs.
async function getContestParticipants(contestId, ageGroup) {
  const wheres = ['cp.contest_id = @contest_id']
  const params = { contest_id: contestId }
  if (ageGroup) {
    wheres.push('cp.age_group_at_entry = @age_group')
    params.age_group = ageGroup
  }
  const query = `
    SELECT
      cp.participation_id,
      cp.contest_id,
      cp.user_id,
      cp.age_group_at_entry,
      cp.entry_date,
      cp.status,
      cp.portfolio_snapshot_id,
      p.portfolio_id            AS p_portfolio_id,
      p.total_portfolio_value   AS p_total_portfolio_value,
      p.total_return_percent    AS p_total_return_percent,
      p.total_return_amount     AS p_total_return_amount,
      p.position_count          AS p_position_count,
      p.positions               AS p_positions
    FROM ${PARTICIPANT_TABLE} cp
    LEFT JOIN ${PORTFOLIO_TABLE} p
      ON p.portfolio_id = cp.portfolio_snapshot_id
    WHERE ${wheres.join(' AND ')}
    ORDER BY cp.entry_date DESC
  `
  const rows = await runQuery(query, params)
  return rows.map(r => ({
    participation_id: r.participation_id,
    contest_id: r.contest_id,
    user_id: r.user_id,
    username: null, // Resolved by callers that join to users; not available here
    age_group_at_entry: r.age_group_at_entry,
    entry_date: unwrapDatetime(r.entry_date),
    status: r.status,
    portfolio_snapshot_id: r.portfolio_snapshot_id,
    portfolio_snapshot: r.p_portfolio_id
      ? {
          portfolio_id: r.p_portfolio_id,
          total_portfolio_value: toNum(r.p_total_portfolio_value),
          total_return_percent: toNum(r.p_total_return_percent),
          total_return_amount: toNum(r.p_total_return_amount),
          position_count: r.p_position_count ?? 0,
          positions: (r.p_positions || []).map(pos => ({
            position_id: pos.position_id,
            symbol: pos.symbol,
            quantity: toNum(pos.quantity),
            purchase_price: toNum(pos.purchase_price),
            current_price: toNum(pos.current_price),
            current_value: toNum(pos.current_value),
            unrealized_gain_loss: toNum(pos.unrealized_gain_loss),
            unrealized_gain_loss_percent: toNum(pos.unrealized_gain_loss_percent),
            updated_at: unwrapDatetime(pos.updated_at),
          })),
        }
      : null,
  }))
}

async function updateParticipantWithPrize(userId, contestId, rank, prizeName) {
  const query = `
    UPDATE ${PARTICIPANT_TABLE}
    SET
      final_rank    = @rank,
      prize_awarded = @prize_name,
      updated_at    = DATETIME(@updated_at)
    WHERE contest_id = @contest_id AND user_id = @user_id
  `
  const params = {
    contest_id: contestId,
    user_id: userId,
    rank,
    prize_name: prizeName,
    updated_at: toBqDatetime(new Date()),
  }
  const types = { rank: 'INT64' }
  await runQuery(query, params, types)
  return true
}

const CONTEST_STATUSES = ['draft', 'active', 'concluded', 'cancelled']

const CONTEST_MUTABLE_FIELDS = new Set([
  'name', 'description', 'age_groups', 'min_age', 'contest_difficulty_level',
  'start_date', 'end_date', 'registration_deadline', 'rules', 'starting_balance',
  'allow_shorting', 'allow_margin', 'max_position_size_percent',
  'allowed_asset_classes', 'max_participants', 'min_participants', 'prizes',
  'status', 'visibility',
])

/**
 * Apply a partial update to a contest. Only fields in CONTEST_MUTABLE_FIELDS
 * are merged; identity, audit, and derived fields are preserved.
 */
async function updateContest(contestId, updates = {}) {
  if ('status' in updates && !CONTEST_STATUSES.includes(updates.status)) {
    throw new Error(
      `Invalid status '${updates.status}'. Allowed: ${CONTEST_STATUSES.join(', ')}`
    )
  }

  const existing = await fetchContestFromDatabase(contestId)
  if (!existing) return null

  for (const [key, value] of Object.entries(updates)) {
    if (!CONTEST_MUTABLE_FIELDS.has(key)) continue
    existing[key] = value
  }
  if ('prizes' in updates) {
    existing.total_prize_pool = calculateTotalPrizePool(existing.prizes)
  }
  if (updates.status === 'concluded' && !existing.concluded_at) {
    existing.concluded_at = new Date()
    existing.winners_announced = true
  } else if (updates.status && updates.status !== 'concluded') {
    existing.concluded_at = null
    existing.winners_announced = false
  }
  existing.updated_at = new Date()

  await updateContestInDatabase(existing)
  return existing
}

module.exports = {
  createContest,
  getContest,
  listContests,
  updateContest,
  joinContest,
  getLeaderboard,
  concludeContest,
  getContestParticipants,
}

// Dev/test bypass: when running without GCP credentials, back the service with
// an in-memory store so the mobile app can be exercised end-to-end.
if (process.env.BEANSTALK_ENVIRONMENT === 'test') {
  module.exports = require('./_memory_store').contest
  console.log('[Beanstalk] :: contest.service → in-memory store (test mode)')
}
