/**
 * Contest Controller
 * Handles contest API requests
 */

const contestService = require('../services/contest.service')
const portfolioService = require('../services/portfolio.service')
const alpacaService = require('../services/alpaca.service')

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
      status,
      short_name,
      timezone,
      sponsor_name,
      sponsor_logo_url,
      sponsor_tagline,
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
      // Short display name + scheduling timezone (both optional)
      ...(short_name ? { short_name } : {}),
      ...(timezone ? { timezone } : {}),
      // Sponsor branding (all optional)
      ...(sponsor_name ? { sponsor_name } : {}),
      ...(sponsor_logo_url ? { sponsor_logo_url } : {}),
      ...(sponsor_tagline ? { sponsor_tagline } : {}),
      // Pass through if provided; service defaults to 'draft' otherwise and
      // rejects unknown values.
      ...(status ? { status } : {}),
    }

    const contest = await contestService.createContest(req.user.user_id, contestData)

    res.status(201).json({
      contest_id: contest.contest_id,
      name: contest.name,
      status: contest.status,
      age_groups: contest.age_groups,
      starting_balance: contest.starting_balance,
      short_name: contest.short_name || null,
      timezone: contest.timezone || null,
      sponsor_name: contest.sponsor_name || null,
      sponsor_logo_url: contest.sponsor_logo_url || null,
      sponsor_tagline: contest.sponsor_tagline || null,
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
        // Prizes are read by the mobile contest list (Contest.fromApi builds the
        // Prize tile from prizes[0]). Without these here the app showed a dash
        // even when a prize was set — the detail endpoint already returns them.
        prizes: c.prizes || [],
        total_prize_pool: c.total_prize_pool || null,
        short_name: c.short_name || null,
        timezone: c.timezone || null,
        sponsor_name: c.sponsor_name || null,
        sponsor_logo_url: c.sponsor_logo_url || null,
        sponsor_tagline: c.sponsor_tagline || null,
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
      short_name: contest.short_name || null,
      timezone: contest.timezone || null,
      sponsor_name: contest.sponsor_name || null,
      sponsor_logo_url: contest.sponsor_logo_url || null,
      sponsor_tagline: contest.sponsor_tagline || null,
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
    // Log full stack so unexpected failures are still diagnosable; previously
    // we printed only `error` which stringified as "[object Object]" in some
    // runtimes and hid the real cause behind a generic 500.
    console.error('Contest join error:', {
      message: error?.message,
      stack: error?.stack,
      contestId: req.params.contestId,
      user_id: req.body?.user_id,
      age_group: req.body?.age_group,
    })

    // Service-level validation errors are all thrown as plain Error with a
    // human-readable message; surface those as 400 so the mobile app can show
    // the real reason (registration closed, already joined, contest full,
    // etc.) instead of a generic "Failed to join contest".
    const userErrors = [
      'not found',
      'not eligible',
      'registration has closed',
      'not accepting participants',
      'already joined',
      'Contest is full',
    ]
    if (error.message && userErrors.some(needle => error.message.includes(needle))) {
      return res.status(400).json({ error: error.message })
    }

    res.status(500).json({ error: 'Failed to join contest', detail: error?.message })
  }
}

/**
 * GET /api/contests/:contestId/participants
 * Get contest participants with real-time status (admin only)
 */
async function getContestParticipants(req, res) {
  try {
    const { contestId } = req.params

    // Check admin permission
    if (!['admin', 'contest_manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and contest managers can view participants' })
    }

    const participants = await contestService.getContestParticipants(contestId)

    // Get real-time portfolio data for each participant
    const participantsWithMetrics = await Promise.all(
      participants.map(async (participant) => {
        const portfolio = await portfolioService.getPortfolio(participant.portfolio_snapshot_id)
        const metrics = await portfolioService.calculatePerformanceMetrics(participant.portfolio_snapshot_id)

        return {
          participation_id: participant.participation_id,
          user_id: participant.user_id,
          age_group: participant.age_group_at_entry,
          entry_date: participant.entry_date,
          status: participant.status,
          portfolio: {
            portfolio_id: portfolio.portfolio_id,
            current_value: portfolio.total_portfolio_value,
            total_return_percent: portfolio.total_return_percent,
            position_count: portfolio.position_count,
          },
          metrics: metrics,
        }
      })
    )

    res.json({
      contest_id: contestId,
      participant_count: participantsWithMetrics.length,
      participants: participantsWithMetrics,
    })
  } catch (error) {
    console.error('Contest participants fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch participants' })
  }
}

// Reprice every participant's contest portfolio with live quotes at most once
// per REPRICE_TTL_MS per contest, so standings track the market instead of
// freezing at each player's last trade. Any failure falls back to the stored
// prices — a stale board beats a 500.
const REPRICE_TTL_MS = 60 * 1000
const lastRepriceAt = new Map() // contestId -> epoch ms

async function repriceContestPortfolios(contestId) {
  const last = lastRepriceAt.get(contestId)
  if (last && Date.now() - last < REPRICE_TTL_MS) return
  // Stamp before the work so a failing quote provider is retried at most
  // once per TTL window instead of on every request.
  lastRepriceAt.set(contestId, Date.now())
  try {
    const participants = await contestService.getContestParticipants(contestId)
    const symbols = [...new Set(
      participants.flatMap(p =>
        (p.portfolio_snapshot?.positions || []).map(pos => pos.symbol)
      )
    )]
    if (symbols.length === 0) return

    const priceMap = await alpacaService.getPriceMap(symbols)
    if (Object.keys(priceMap).length === 0) return

    await Promise.all(
      participants
        .filter(p =>
          p.portfolio_snapshot_id &&
          (p.portfolio_snapshot?.positions || []).length > 0
        )
        .map(p =>
          portfolioService.updatePortfolioPrices(p.portfolio_snapshot_id, priceMap)
            .catch(err => {
              console.error(`[contest.reprice] portfolio ${p.portfolio_snapshot_id}:`, err.message)
            })
        )
    )
  } catch (error) {
    console.error('[contest.reprice] skipped:', error.message)
  }
}

async function getLeaderboard(req, res) {
  try {
    const { contestId } = req.params
    const { age_group } = req.query

    await repriceContestPortfolios(contestId)

    const leaderboards = await contestService.getLeaderboard(contestId, age_group)

    res.json({
      contest_id: contestId,
      leaderboards: leaderboards,
      as_of: new Date().toISOString(),
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

/**
 * PUT /api/contests/:contestId
 * Update mutable fields on a contest (status, dates, prizes, copy, caps).
 * Admin / contest manager only. Immutable identity/audit/derived fields
 * (contest_id, creator_id, created_at, current_participants,
 * total_prize_pool, winners_announced) are ignored by the service.
 */
async function updateContest(req, res) {
  try {
    if (!['admin', 'contest_manager'].includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: 'Only admins and contest managers can update contests' })
    }

    const { contestId } = req.params
    const updates = req.body || {}

    // Normalize date fields so the service sees Date objects (same shape as
    // createContest). Reject out-of-order windows before hitting the store.
    if (updates.start_date) updates.start_date = new Date(updates.start_date)
    if (updates.end_date) updates.end_date = new Date(updates.end_date)
    if (updates.registration_deadline) {
      updates.registration_deadline = new Date(updates.registration_deadline)
    }
    if (updates.start_date && updates.end_date && updates.start_date >= updates.end_date) {
      return res.status(400).json({ error: 'start_date must be before end_date' })
    }

    const contest = await contestService.updateContest(contestId, updates)
    if (!contest) return res.status(404).json({ error: 'Contest not found' })

    res.json(contest)
  } catch (error) {
    console.error('Contest update error:', error)
    // Validation errors from the service (e.g. invalid status) surface as 400.
    if (error.message && error.message.startsWith('Invalid status')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: 'Failed to update contest' })
  }
}

/**
 * GET /api/contests/:contestId/messages
 * Contest chat feed (any authenticated user; contests are public in the beta).
 */
async function getContestMessages(req, res) {
  try {
    if (typeof contestService.listContestMessages !== 'function') {
      return res.status(501).json({ error: 'Contest chat is only available in demo mode' })
    }
    const { contestId } = req.params
    const contest = await contestService.getContest(contestId)
    if (!contest) return res.status(404).json({ error: 'Contest not found' })

    const messages = await contestService.listContestMessages(contestId)
    res.json({ count: messages.length, messages })
  } catch (error) {
    console.error('Contest messages fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
}

/**
 * POST /api/contests/:contestId/messages  { text }
 * Username is resolved server-side from the authenticated user so clients
 * can't impersonate each other.
 */
async function postContestMessage(req, res) {
  try {
    if (typeof contestService.createContestMessage !== 'function') {
      return res.status(501).json({ error: 'Contest chat is only available in demo mode' })
    }
    const { contestId } = req.params
    const text = (req.body && typeof req.body.text === 'string') ? req.body.text.trim() : ''
    if (!text) return res.status(400).json({ error: 'Message text is required' })
    if (text.length > 500) return res.status(400).json({ error: 'Message too long (max 500 chars)' })

    const contest = await contestService.getContest(contestId)
    if (!contest) return res.status(404).json({ error: 'Contest not found' })

    let username = 'Player'
    try {
      const userService = require('../services/user.service')
      const u = await userService.getUserById(req.user.user_id)
      if (u && u.name) username = u.name
    } catch (_) { /* keep fallback */ }

    const msg = await contestService.createContestMessage(contestId, {
      user_id: req.user.user_id,
      username,
      text,
    })
    res.status(201).json(msg)
  } catch (error) {
    console.error('Contest message post error:', error)
    res.status(500).json({ error: 'Failed to post message' })
  }
}

module.exports = {
  createContest,
  listContests,
  getContest,
  updateContest,
  joinContest,
  getContestMessages,
  postContestMessage,
  getLeaderboard,
  concludeContest,
  getContestParticipants,
}
