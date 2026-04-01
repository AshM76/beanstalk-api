/**
 * Contest Controller
 * Handles contest API requests
 */

const contestService = require('../../services/contest.service')

/**
 * POST /api/contests
 * Create a new contest (admin/contest manager only)
 */
async function createContest(req, res) {
  try {
    // Check permission
    if (!['admin', 'contest_manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and contest managers can create contests' })
    }

    const {
      name,
      description,
      age_groups,
      start_date,
      end_date,
      starting_balance,
      rules,
      prizes,
      max_participants,
      visibility,
    } = req.body

    // Validate required fields
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields: name, start_date, end_date' })
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'start_date must be before end_date' })
    }

    const contestData = {
      name,
      description,
      age_groups: age_groups || ['high_school', 'college', 'adults'],
      start_date: startDate,
      end_date: endDate,
      starting_balance: starting_balance || 10000,
      rules,
      prizes: prizes || [],
      max_participants,
      visibility: visibility || 'public',
    }

    const contest = await contestService.createContest(req.user.user_id, contestData)

    res.status(201).json({
      contest_id: contest.contest_id,
      name: contest.name,
      status: contest.status,
      age_groups: contest.age_groups,
      starting_balance: contest.starting_balance,
      created_at: contest.created_at,
    })
  } catch (error) {
    console.error('Contest creation error:', error)
    res.status(500).json({ error: 'Failed to create contest' })
  }
}

/**
 * GET /api/contests
 * List contests with filters
 */
async function listContests(req, res) {
  try {
    const { status, age_group, difficulty, visibility, limit = 20, offset = 0 } = req.query

    const filters = {}

    if (status) filters.status = status
    if (age_group) filters.age_groups = age_group
    if (difficulty) filters.contest_difficulty_level = difficulty
    if (visibility) filters.visibility = visibility

    const options = {
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
    }

    const contests = await contestService.listContests(filters, options)

    res.json({
      count: contests.length,
      contests: contests.map(c => ({
        contest_id: c.contest_id,
        name: c.name,
        description: c.description,
        age_groups: c.age_groups,
        difficulty: c.contest_difficulty_level,
        status: c.status,
        start_date: c.start_date,
        end_date: c.end_date,
        participants: c.current_participants,
        max_participants: c.max_participants,
        starting_balance: c.starting_balance,
      })),
    })
  } catch (error) {
    console.error('Contest list error:', error)
    res.status(500).json({ error: 'Failed to fetch contests' })
  }
}

/**
 * GET /api/contests/:contestId
 * Get contest details
 */
async function getContest(req, res) {
  try {
    const { contestId } = req.params

    const contest = await contestService.getContest(contestId)

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' })
    }

    res.json({
      contest_id: contest.contest_id,
      name: contest.name,
      description: contest.description,
      age_groups: contest.age_groups,
      difficulty: contest.contest_difficulty_level,
      status: contest.status,
      start_date: contest.start_date,
      end_date: contest.end_date,
      registration_deadline: contest.registration_deadline,
      rules: contest.rules,
      starting_balance: contest.starting_balance,
      allow_shorting: contest.allow_shorting,
      allow_margin: contest.allow_margin,
      max_position_size_percent: contest.max_position_size_percent,
      allowed_asset_classes: contest.allowed_asset_classes,
      participants: contest.current_participants,
      max_participants: contest.max_participants,
      prizes: contest.prizes,
      visibility: contest.visibility,
    })
  } catch (error) {
    console.error('Contest fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch contest' })
  }
}

/**
 * POST /api/contests/:contestId/join
 * User joins a contest
 */
async function joinContest(req, res) {
  try {
    const { contestId } = req.params
    const { user_id, age_group } = req.body

    // Verify user owns the request
    if (req.user.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!age_group) {
      return res.status(400).json({ error: 'age_group is required' })
    }

    const participation = await contestService.joinContest(contestId, user_id, age_group)

    res.status(201).json({
      participation_id: participation.participation_id,
      contest_id: participation.contest_id,
      user_id: participation.user_id,
      portfolio_id: participation.portfolio_snapshot_id,
      status: participation.status,
      entry_date: participation.entry_date,
      message: 'Successfully joined contest',
    })
  } catch (error) {
    console.error('Contest join error:', error)

    if (error.message.includes('not found') || error.message.includes('not eligible')) {
      return res.status(400).json({ error: error.message })
    }

    res.status(500).json({ error: 'Failed to join contest' })
  }
}

/**
 * GET /api/contests/:contestId/leaderboard
 * Get contest leaderboard
 */
async function getLeaderboard(req, res) {
  try {
    const { contestId } = req.params
    const { age_group } = req.query

    const leaderboards = await contestService.getLeaderboard(contestId, age_group)

    res.json({
      contest_id: contestId,
      leaderboards: leaderboards,
    })
  } catch (error) {
    console.error('Leaderboard fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch leaderboard' })
  }
}

/**
 * POST /api/contests/:contestId/conclude
 * Conclude contest and assign prizes (admin only)
 */
async function concludeContest(req, res) {
  try {
    // Check permission
    if (!['admin', 'contest_manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and contest managers can conclude contests' })
    }

    const { contestId } = req.params

    const result = await contestService.concludeContest(contestId)

    res.json({
      contest_id: result.contest_id,
      concluded_at: result.concluded_at,
      results_by_age_group: Object.keys(result.results).map(ageGroup => ({
        age_group: ageGroup,
        winner_count: result.results[ageGroup].length,
        winners: result.results[ageGroup],
      })),
    })
  } catch (error) {
    console.error('Contest conclude error:', error)

    if (error.message.includes('not found') || error.message.includes('already concluded')) {
      return res.status(400).json({ error: error.message })
    }

    res.status(500).json({ error: 'Failed to conclude contest' })
  }
}

module.exports = {
  createContest,
  listContests,
  getContest,
  joinContest,
  getLeaderboard,
  concludeContest,
}
