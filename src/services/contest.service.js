/**
 * Contest Service
 * Handles contest operations: creation, participation, rankings, results
 */

const { v4: uuidv4 } = require('uuid')
const portfolioService = require('./portfolio.service')

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
    starting_balance: contestData.starting_balance || 100000,
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

// Database helper functions (placeholders - implement with BigQuery client)
async function saveContestToDatabase(contest) {
  // TODO: Implement BigQuery insert
  return contest
}

async function fetchContestFromDatabase(contestId) {
  // TODO: Implement BigQuery query
  return null
}

async function fetchContestsFromDatabase(filters, options) {
  // TODO: Implement BigQuery query with filters
  return []
}

async function checkUserInContest(contestId, userId) {
  // TODO: Implement BigQuery query
  return false
}

async function saveParticipationToDatabase(participation) {
  // TODO: Implement BigQuery insert
  return participation
}

async function updateContestInDatabase(contest) {
  // TODO: Implement BigQuery update
  return contest
}

async function getContestParticipants(contestId, ageGroup) {
  // TODO: Implement BigQuery query with portfolio data joined
  return []
}

async function updateParticipantWithPrize(userId, contestId, rank, prizeName) {
  // TODO: Implement BigQuery update
  return true
}

module.exports = {
  createContest,
  getContest,
  listContests,
  joinContest,
  getLeaderboard,
  concludeContest,
}
