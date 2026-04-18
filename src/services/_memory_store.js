/**
 * In-memory backing store for portfolio + contest services.
 *
 * Activated when BEANSTALK_ENVIRONMENT === 'test' and the GCP service-account
 * key is absent, so the mobile app can be exercised end-to-end without
 * BigQuery credentials. State lives only for the lifetime of the Node
 * process — restarting the server wipes everything.
 */

const crypto = require('crypto')
const { classifyAsset } = require('./assetFilter.service')

const uuidv4 = () => crypto.randomUUID()

// Tables
const users = new Map()             // user_id -> user object
const usersByEmail = new Map()      // email (lowercase) -> user_id (index)
const portfolios = new Map()        // portfolio_id -> portfolio
const transactions = []             // flat list of transaction rows
const contests = new Map()          // contest_id -> contest
const participations = []           // participation rows

// ── Portfolio helpers ─────────────────────────────────────────

function newPortfolio(userId, startingBalance, portfolioType, contestId) {
  return {
    portfolio_id: uuidv4(),
    user_id: userId,
    portfolio_type: portfolioType,
    contest_id: contestId || null,
    starting_balance: startingBalance,
    current_cash_balance: startingBalance,
    total_invested: 0,
    total_position_value: 0,
    total_portfolio_value: startingBalance,
    total_return_amount: 0,
    total_return_percent: 0,
    daily_return_percent: 0,
    highest_portfolio_value: startingBalance,
    lowest_portfolio_value: startingBalance,
    positions: [],
    position_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    last_price_update: null,
  }
}

async function createPortfolio(userId, startingBalance, portfolioType = 'main', contestId = null) {
  if (portfolioType === 'main') {
    const existing = await getUserMainPortfolio(userId)
    if (existing) return existing
  } else if (portfolioType === 'contest') {
    if (!contestId) throw new Error('contestId is required when creating a contest portfolio')
    const existing = await getUserContestPortfolio(userId, contestId)
    if (existing) return existing
  }
  const p = newPortfolio(userId, startingBalance, portfolioType, contestId)
  portfolios.set(p.portfolio_id, p)
  return p
}

async function getPortfolio(portfolioId) {
  return portfolios.get(portfolioId) || null
}

async function getUserMainPortfolio(userId) {
  for (const p of portfolios.values()) {
    if (p.user_id === userId && p.portfolio_type === 'main') return p
  }
  return null
}

async function getUserContestPortfolio(userId, contestId) {
  for (const p of portfolios.values()) {
    if (p.user_id === userId && p.portfolio_type === 'contest' && p.contest_id === contestId) return p
  }
  return null
}

async function getUserPortfolios(userId) {
  return [...portfolios.values()].filter(p => p.user_id === userId)
}

async function executeBuyTrade(portfolioId, symbol, quantity, price) {
  const p = portfolios.get(portfolioId)
  if (!p) throw new Error('Portfolio not found')
  const totalCost = quantity * price
  if (p.current_cash_balance < totalCost) throw new Error('Insufficient cash balance for this trade')

  const tx = {
    transaction_id: uuidv4(),
    portfolio_id: portfolioId,
    user_id: p.user_id,
    transaction_type: 'buy',
    symbol, quantity, price,
    amount: totalCost,
    transaction_date: new Date(),
    settlement_date: new Date(Date.now() + 2 * 86400000),
    created_at: new Date(),
    status: 'completed',
  }
  transactions.push(tx)

  const existing = p.positions.find(pos => pos.symbol === symbol)
  if (existing) {
    const totalShares = existing.quantity + quantity
    const totalValue = existing.quantity * existing.purchase_price + totalCost
    existing.purchase_price = totalValue / totalShares
    existing.quantity = totalShares
    existing.current_price = price
    existing.current_value = totalShares * price
    existing.updated_at = new Date()
    // Lazy-backfill asset_class on legacy in-memory positions. Matches
    // the BQ store's behavior so the two codepaths stay interchangeable.
    if (!existing.asset_class) {
      existing.asset_class = await classifyAsset(symbol)
    }
  } else {
    const assetClass = await classifyAsset(symbol)
    p.positions.push({
      position_id: uuidv4(),
      symbol, quantity,
      purchase_price: price,
      purchase_date: new Date(),
      current_price: price,
      current_value: totalCost,
      unrealized_gain_loss: 0,
      unrealized_gain_loss_percent: 0,
      updated_at: new Date(),
      asset_class: assetClass,
    })
    p.position_count++
  }

  p.current_cash_balance -= totalCost
  p.total_invested += totalCost
  p.total_position_value += totalCost
  p.total_portfolio_value = p.current_cash_balance + p.total_position_value
  p.updated_at = new Date()
  return tx
}

async function executeSellTrade(portfolioId, symbol, quantity, price) {
  const p = portfolios.get(portfolioId)
  if (!p) throw new Error('Portfolio not found')
  const pos = p.positions.find(x => x.symbol === symbol)
  if (!pos || pos.quantity < quantity) throw new Error('Insufficient shares to sell')

  const proceeds = quantity * price
  const tx = {
    transaction_id: uuidv4(),
    portfolio_id: portfolioId,
    user_id: p.user_id,
    transaction_type: 'sell',
    symbol, quantity, price,
    amount: proceeds,
    transaction_date: new Date(),
    settlement_date: new Date(Date.now() + 2 * 86400000),
    created_at: new Date(),
    status: 'completed',
  }
  transactions.push(tx)

  pos.quantity -= quantity
  if (pos.quantity === 0) {
    p.positions = p.positions.filter(x => x.symbol !== symbol)
    p.position_count--
  }
  p.current_cash_balance += proceeds
  p.total_position_value = p.positions.reduce((s, x) => s + x.quantity * x.current_price, 0)
  p.total_portfolio_value = p.current_cash_balance + p.total_position_value
  p.updated_at = new Date()
  return tx
}

async function updatePortfolioPrices(portfolioId, priceMap) {
  const p = portfolios.get(portfolioId)
  if (!p) throw new Error('Portfolio not found')
  for (const pos of p.positions) {
    const newPrice = priceMap[pos.symbol]
    if (newPrice == null) continue
    pos.current_price = newPrice
    pos.current_value = pos.quantity * newPrice
    pos.unrealized_gain_loss = pos.current_value - pos.quantity * pos.purchase_price
    pos.unrealized_gain_loss_percent =
      pos.purchase_price > 0 ? (pos.unrealized_gain_loss / (pos.quantity * pos.purchase_price)) * 100 : 0
    pos.updated_at = new Date()
  }
  p.total_position_value = p.positions.reduce((s, x) => s + x.current_value, 0)
  p.total_portfolio_value = p.current_cash_balance + p.total_position_value
  p.total_return_amount = p.total_portfolio_value - p.starting_balance
  p.total_return_percent =
    p.starting_balance > 0 ? (p.total_return_amount / p.starting_balance) * 100 : 0
  p.highest_portfolio_value = Math.max(p.highest_portfolio_value, p.total_portfolio_value)
  p.lowest_portfolio_value = Math.min(p.lowest_portfolio_value, p.total_portfolio_value)
  p.last_price_update = new Date()
  p.updated_at = new Date()
  return p
}

async function getPortfolioTransactions(portfolioId, options = {}) {
  const { limit = 50, offset = 0, type } = options
  let rows = transactions.filter(t => t.portfolio_id === portfolioId)
  if (type) rows = rows.filter(t => t.transaction_type === type)
  rows.sort((a, b) => b.transaction_date - a.transaction_date)
  return rows.slice(offset, offset + limit)
}

async function calculatePerformanceMetrics(portfolioId) {
  const p = portfolios.get(portfolioId)
  if (!p) return null
  return {
    portfolio_id: portfolioId,
    total_portfolio_value: p.total_portfolio_value,
    total_return_amount: p.total_return_amount,
    total_return_percent: p.total_return_percent,
    daily_return_percent: p.daily_return_percent,
    highest_portfolio_value: p.highest_portfolio_value,
    lowest_portfolio_value: p.lowest_portfolio_value,
    position_count: p.position_count,
  }
}

// ── Contest helpers ───────────────────────────────────────────

function calculateTotalPrizePool(prizes) {
  return (prizes || []).reduce((s, p) => s + (Number(p.prize_value) || 0), 0)
}

const CONTEST_STATUSES = ['draft', 'active', 'concluded', 'cancelled']

async function createContest(creatorId, data) {
  // Honor caller-supplied status if it's in the allowed set; otherwise fall
  // back to 'draft'. Unknown values are ignored rather than rejected so the
  // admin form can lean on the default without client-side validation.
  const status = CONTEST_STATUSES.includes(data.status) ? data.status : 'draft'
  const c = {
    contest_id: uuidv4(),
    creator_id: creatorId,
    name: data.name,
    description: data.description,
    age_groups: data.age_groups || ['high_school', 'college', 'adults'],
    min_age: data.min_age || 13,
    contest_difficulty_level: data.contest_difficulty_level || 'beginner',
    start_date: data.start_date,
    end_date: data.end_date,
    // Default to end_date rather than start_date — in dev/test we want
    // active contests to accept late joiners for the full contest window,
    // which matches how the mobile UI surfaces "Join" on active contests.
    // Real prod behavior (contest.service.js w/ BigQuery) still mirrors the
    // caller-supplied value and is unaffected.
    registration_deadline: data.registration_deadline || data.end_date || data.start_date,
    rules: data.rules,
    starting_balance: data.starting_balance || 10000,
    allow_shorting: !!data.allow_shorting,
    allow_margin: !!data.allow_margin,
    max_position_size_percent: data.max_position_size_percent || 25,
    allowed_asset_classes: data.allowed_asset_classes || ['stocks', 'etfs'],
    max_participants: data.max_participants || null,
    current_participants: 0,
    min_participants: data.min_participants || 2,
    prizes: data.prizes || [],
    total_prize_pool: calculateTotalPrizePool(data.prizes),
    status,
    visibility: data.visibility || 'public',
    sponsor_name: data.sponsor_name || null,
    sponsor_logo_url: data.sponsor_logo_url || null,
    sponsor_tagline: data.sponsor_tagline || null,
    winners_announced: false,
    concluded_at: status === 'concluded' ? new Date() : null,
    created_at: new Date(),
    updated_at: new Date(),
  }
  contests.set(c.contest_id, c)
  return c
}

async function getContest(id) {
  return contests.get(id) || null
}

// Mutable fields on a contest. Anything not in this list is silently ignored
// by updateContest — including immutable identity/audit fields (contest_id,
// creator_id, created_at) and derived counts (current_participants,
// total_prize_pool, winners_announced).
const CONTEST_MUTABLE_FIELDS = new Set([
  'name',
  'description',
  'age_groups',
  'min_age',
  'contest_difficulty_level',
  'start_date',
  'end_date',
  'registration_deadline',
  'rules',
  'starting_balance',
  'allow_shorting',
  'allow_margin',
  'max_position_size_percent',
  'allowed_asset_classes',
  'max_participants',
  'min_participants',
  'prizes',
  'status',
  'visibility',
  'sponsor_name',
  'sponsor_logo_url',
  'sponsor_tagline',
])

async function updateContest(contestId, updates = {}) {
  const c = contests.get(contestId)
  if (!c) return null

  if ('status' in updates && !CONTEST_STATUSES.includes(updates.status)) {
    throw new Error(
      `Invalid status '${updates.status}'. Allowed: ${CONTEST_STATUSES.join(', ')}`
    )
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!CONTEST_MUTABLE_FIELDS.has(key)) continue
    c[key] = value
  }

  // Keep derived fields consistent with any updates that landed above.
  if ('prizes' in updates) {
    c.total_prize_pool = calculateTotalPrizePool(c.prizes)
  }
  if (updates.status === 'concluded' && !c.concluded_at) {
    c.concluded_at = new Date()
    c.winners_announced = true
  }
  if (updates.status && updates.status !== 'concluded') {
    // Re-opening a contest (e.g. concluded → active) clears the conclusion
    // stamp so the leaderboard flow can run again if needed.
    c.concluded_at = null
    c.winners_announced = false
  }

  c.updated_at = new Date()
  return c
}

async function listContests(filters = {}, options = { limit: 20, offset: 0 }) {
  let rows = [...contests.values()]
  if (filters.status) rows = rows.filter(c => c.status === filters.status)
  if (filters.visibility) rows = rows.filter(c => c.visibility === filters.visibility)
  if (filters.difficulty) rows = rows.filter(c => c.contest_difficulty_level === filters.difficulty)
  if (filters.age_group) rows = rows.filter(c => c.age_groups.includes(filters.age_group))
  rows.sort((a, b) => b.created_at - a.created_at)
  const { limit = 20, offset = 0 } = options
  return rows.slice(offset, offset + limit)
}

async function joinContest(contestId, userId, ageGroup) {
  const c = contests.get(contestId)
  if (!c) throw new Error('Contest not found')
  if (new Date() > new Date(c.registration_deadline)) throw new Error('Contest registration has closed')
  if (c.status !== 'active' && c.status !== 'draft') throw new Error('Contest is not accepting participants')
  if (!c.age_groups.includes(ageGroup)) throw new Error(`Age group '${ageGroup}' is not eligible for this contest`)
  if (c.max_participants && c.current_participants >= c.max_participants) throw new Error('Contest is full')
  if (participations.find(p => p.contest_id === contestId && p.user_id === userId)) {
    throw new Error('User already joined this contest')
  }

  const cp = await createPortfolio(userId, c.starting_balance, 'contest', contestId)
  const participation = {
    participation_id: uuidv4(),
    contest_id: contestId,
    user_id: userId,
    age_group_at_entry: ageGroup,
    portfolio_snapshot_id: cp.portfolio_id,
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
  participations.push(participation)
  c.current_participants++
  if (c.current_participants >= c.min_participants && c.status === 'draft') c.status = 'active'
  c.updated_at = new Date()
  return participation
}

async function getContestParticipants(contestId, ageGroup) {
  const rows = participations.filter(
    p => p.contest_id === contestId && (!ageGroup || p.age_group_at_entry === ageGroup)
  )
  return rows.map(p => ({
    ...p,
    username: p.user_id, // no user table in-memory; surface the id
    portfolio_snapshot: portfolios.get(p.portfolio_snapshot_id) || null,
  }))
}

async function getLeaderboard(contestId, ageGroup = null) {
  const c = contests.get(contestId)
  if (!c) throw new Error('Contest not found')
  const participants = await getContestParticipants(contestId, ageGroup)
  participants.sort(
    (a, b) =>
      (b.portfolio_snapshot?.total_portfolio_value || 0) -
      (a.portfolio_snapshot?.total_portfolio_value || 0)
  )
  const rankings = participants.map((p, i) => ({
    rank: i + 1,
    user_id: p.user_id,
    username: p.username,
    portfolio_value: p.portfolio_snapshot?.total_portfolio_value || 0,
    return_percent: p.portfolio_snapshot?.total_return_percent || 0,
    position_count: p.portfolio_snapshot?.position_count || 0,
    best_performing_position: null,
    best_position_return_percent: 0,
    last_trade_date: null,
  }))

  const leaderboards = {}
  const groups = ageGroup ? [ageGroup] : c.age_groups
  for (const g of groups) {
    const gr = rankings.filter(r => {
      const p = participants.find(x => x.user_id === r.user_id)
      return p?.age_group_at_entry === g
    })
    leaderboards[g] = {
      leaderboard_id: uuidv4(),
      contest_id: contestId,
      age_group: g,
      rankings: gr,
      total_participants: gr.length,
      updated_at: new Date(),
    }
  }
  return leaderboards
}

async function concludeContest(contestId) {
  const c = contests.get(contestId)
  if (!c) throw new Error('Contest not found')
  if (c.status === 'concluded') throw new Error('Contest has already concluded')
  const leaderboards = await getLeaderboard(contestId)
  const results = {}
  for (const [g, lb] of Object.entries(leaderboards)) {
    results[g] = lb.rankings
      .map(r => {
        const prize = c.prizes.find(p => r.rank >= p.rank_from && r.rank <= p.rank_to)
        if (!prize) return null
        return {
          rank: r.rank,
          user_id: r.user_id,
          username: r.username,
          portfolio_value: r.portfolio_value,
          return_percent: r.return_percent,
          prize: prize.prize_description,
          prize_type: prize.prize_type,
          prize_value: prize.prize_value,
        }
      })
      .filter(Boolean)
  }
  c.status = 'concluded'
  c.winners_announced = true
  c.concluded_at = new Date()
  c.updated_at = new Date()
  return { contest_id: contestId, concluded_at: c.concluded_at, results }
}

module.exports = {
  portfolio: {
    createPortfolio,
    getPortfolio,
    getUserMainPortfolio,
    getUserContestPortfolio,
    getUserPortfolios,
    executeBuyTrade,
    executeSellTrade,
    updatePortfolioPrices,
    getPortfolioTransactions,
    calculatePerformanceMetrics,
  },
  contest: {
    createContest,
    getContest,
    listContests,
    updateContest,
    joinContest,
    getLeaderboard,
    concludeContest,
    getContestParticipants,
  },
  users: {
    createUser,
    getUserByEmail,
    getUserById,
  },
}

// ── User helpers ────────────────────────────────────────────────

function createUser(name, email, passwordHash) {
  const user = {
    user_id: uuidv4(),
    name,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    avatar_url: null,
    created_at: new Date(),
  }
  users.set(user.user_id, user)
  usersByEmail.set(user.email, user.user_id)
  return { user_id: user.user_id, name: user.name, email: user.email, avatar_url: user.avatar_url, created_at: user.created_at }
}

function getUserByEmail(email) {
  const id = usersByEmail.get((email || '').toLowerCase())
  return id ? users.get(id) || null : null
}

function getUserById(userId) {
  const u = users.get(userId)
  if (!u) return null
  return { user_id: u.user_id, name: u.name, email: u.email, avatar_url: u.avatar_url, created_at: u.created_at }
}
