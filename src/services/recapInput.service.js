/**
 * Recap INPUT builder — PURE CODE, no AI.
 *
 * First step of the Cash-narrated contest recap (see
 * Design/Contest-Recap-Generation-Spec.md). From a concluded contest's data —
 * every contestant's per-contest portfolio + positions, and the ghost
 * benchmark curves — this assembles the compact, structured INPUT payload the
 * recap generator later hands to Claude.
 *
 * The whole point of doing this in code: the model narrates only **verified,
 * pre-computed numbers** and can't invent figures. So this file does all the
 * math (medians, "share that beat the market", best trade, sector averages)
 * and picks the facts; the AI just tells the story.
 *
 * Two entry points:
 *   - buildRecapInput({ contest, participants, benchmarks, personalUserId })
 *       PURE and synchronous — the core, fully unit-testable with plain data.
 *   - assembleRecapInput(contestId, opts)
 *       async orchestrator: fetches contest + participants + benchmark curves
 *       from the services, then calls buildRecapInput. This is the
 *       "from a concluded contest" entry point.
 *
 * Privacy (locked decision): positive callouts (best trade, winner) are named
 * by **display name**; losses/negatives (biggest swing, field aggregates) stay
 * anonymous. A UUID-shaped username means the player has no real display name,
 * so we treat it as anonymous (player: null) — matching the mobile client,
 * which anonymizes UUID-shaped names.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

// The two benchmark anchors the "active vs passive" story hinges on. Ids match
// benchmark.service.js's ghost roster.
const SAMMY_P_ID = 'ghost:spx' // S&P 500 — "did you beat the market?"
const PIGGY_ID = 'ghost:cash' // savings — "was moving the money around even worth it?"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Round to `dp` decimals; null for null/undefined or anything non-finite. */
function round(v, dp = 2) {
  if (v == null) return null // Number(null) === 0 would otherwise mask it
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const f = 10 ** dp
  return Math.round(n * f) / f
}

function toDate(v) {
  if (!v) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'object' && v.value) return toDate(v.value)
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Median of a numeric array; null when empty. */
function median(nums) {
  const xs = nums.filter(n => Number.isFinite(n)).sort((a, b) => a - b)
  if (xs.length === 0) return null
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}

/** Fraction (0..1) of `nums` strictly greater than `threshold`; null when empty. */
function shareAbove(nums, threshold) {
  const xs = nums.filter(n => Number.isFinite(n))
  if (xs.length === 0 || !Number.isFinite(threshold)) return null
  return xs.filter(n => n > threshold).length / xs.length
}

/**
 * A display name for a *positive* callout, or null to keep it anonymous.
 * A real name is used as-is; a UUID-shaped username (no real name on file)
 * stays anonymous so we never leak an id as if it were a name.
 */
function friendlyName(entry) {
  const name = entry && typeof entry.username === 'string' ? entry.username.trim() : ''
  if (!name || UUID_RE.test(name)) return null
  return name
}

function snapshotOf(p) {
  return (p && p.portfolio_snapshot) || null
}

function positionsOf(p) {
  const snap = snapshotOf(p)
  return snap && Array.isArray(snap.positions) ? snap.positions : []
}

function returnPercentOf(p) {
  const snap = snapshotOf(p)
  return snap ? toNum(snap.total_return_percent) : null
}

function portfolioValueOf(p) {
  const snap = snapshotOf(p)
  return snap ? toNum(snap.total_portfolio_value) : null
}

/**
 * Build the recap INPUT payload. PURE — no I/O, no AI.
 *
 * @param {object}   args.contest        contest record (name, start_date, end_date, starting_balance, current_participants)
 * @param {Array}    args.participants   from getContestParticipants (all age groups), each with portfolio_snapshot
 * @param {Array}    args.benchmarks     ghost rankings from benchmarkService.computeGhostRankings
 * @param {string=}  args.personalUserId when set (and found), also emits a `personal` mini-recap block
 * @returns {object} the recap INPUT contract (see the spec)
 */
function buildRecapInput({ contest, participants = [], benchmarks = [], personalUserId = null } = {}) {
  if (!contest) throw new Error('buildRecapInput: contest is required')

  const ghosts = Array.isArray(benchmarks) ? benchmarks : []
  const players = (Array.isArray(participants) ? participants : []).filter(Boolean)
  // Stats are over players who actually have a portfolio snapshot.
  const active = players.filter(p => snapshotOf(p))

  // ---- contest -----------------------------------------------------------
  const start = toDate(contest.start_date)
  const end = toDate(contest.end_date)
  const days = start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)) : null

  const contestBlock = {
    name: contest.name || null,
    days,
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : null,
    starting_balance: toNum(contest.starting_balance),
    player_count: players.length,
  }

  // ---- market_context (from the ghost curves) ----------------------------
  const sammy = ghosts.find(g => g.user_id === SAMMY_P_ID) || null
  const piggy = ghosts.find(g => g.user_id === PIGGY_ID) || null
  const sammyReturn = sammy ? toNum(sammy.return_percent) : null
  const piggyReturn = piggy ? toNum(piggy.return_percent) : null

  const benchmarkList = ghosts.map(g => ({
    name: g.username || null,
    label: g.benchmark || null,
    return_percent: round(g.return_percent),
  }))

  // "best benchmark" = best-performing *market* index (savings/Piggy excluded);
  // the passive market bar the field is measured against.
  const marketGhosts = ghosts.filter(g => g.benchmark_symbol) // symbol ghosts only
  let bestBenchmark = null
  for (const g of marketGhosts) {
    const r = toNum(g.return_percent)
    if (r == null) continue
    if (bestBenchmark == null || r > bestBenchmark.r) bestBenchmark = { name: g.username || null, r }
  }

  const marketContext = {
    benchmarks: benchmarkList,
    best_benchmark: bestBenchmark ? bestBenchmark.name : null,
    savings_return_percent: round(piggyReturn),
  }

  // ---- field (aggregate, anonymous) --------------------------------------
  const returns = active.map(returnPercentOf).filter(n => n != null)
  const field = {
    median_return_percent: round(median(returns)),
    share_that_beat_sammy_p: sammyReturn == null ? null : round(shareAbove(returns, sammyReturn), 4),
    share_that_beat_piggy: piggyReturn == null ? null : round(shareAbove(returns, piggyReturn), 4),
  }

  // ---- highlights (across every position of every player) ----------------
  const owned = [] // { pos, owner }
  for (const p of active) {
    for (const pos of positionsOf(p)) {
      if (pos && pos.symbol) owned.push({ pos, owner: p })
    }
  }
  const highlights = {
    best_trade: bestTrade(owned, end),
    biggest_swing: biggestSwing(owned),
    top_sectors: topSectors(owned, 3),
    most_popular_symbols: mostPopularSymbols(active, 5),
  }

  // ---- winner (rank #1 by portfolio value, framed positively) ------------
  const winner = topPlayer(active, sammyReturn)

  const input = {
    contest: contestBlock,
    market_context: marketContext,
    field,
    highlights,
    winner,
  }

  // ---- personal mini-recap (optional) ------------------------------------
  if (personalUserId) {
    const me = active.find(p => p.user_id === personalUserId)
    if (me) input.personal = personalRecap(me, { sammyReturn, piggyReturn, end })
  }

  return input
}

/** Best individual position by return %; named (positive callout). */
function bestTrade(owned, endDate) {
  let best = null
  for (const { pos, owner } of owned) {
    const r = toNum(pos.unrealized_gain_loss_percent)
    if (r == null) continue
    if (best == null || r > best.r) best = { pos, owner, r }
  }
  if (!best) return null
  return {
    symbol: best.pos.symbol,
    return_percent: round(best.r),
    held_days: heldDays(best.pos, endDate),
    player: friendlyName(best.owner),
  }
}

/** Largest absolute mover by return %; anonymous (could be a loss). */
function biggestSwing(owned) {
  let best = null
  for (const { pos } of owned) {
    const r = toNum(pos.unrealized_gain_loss_percent)
    if (r == null) continue
    if (best == null || Math.abs(r) > Math.abs(best.r)) best = { pos, r }
  }
  if (!best) return null
  return { symbol: best.pos.symbol, swing_percent: round(best.r) }
}

/**
 * Average return by asset_class tag, best sectors first. Positions with no
 * asset_class tag (e.g. the BQ store doesn't return one) are skipped; the
 * result is [] when nothing is tagged — the recap prompt handles an empty list.
 */
function topSectors(owned, limit) {
  const byClass = new Map() // asset_class -> { sum, n }
  for (const { pos } of owned) {
    const sector = pos.asset_class
    const r = toNum(pos.unrealized_gain_loss_percent)
    if (!sector || r == null) continue
    const agg = byClass.get(sector) || { sum: 0, n: 0 }
    agg.sum += r
    agg.n += 1
    byClass.set(sector, agg)
  }
  return [...byClass.entries()]
    .map(([sector, { sum, n }]) => ({ sector, avg_return_percent: round(sum / n) }))
    .sort((a, b) => (b.avg_return_percent ?? -Infinity) - (a.avg_return_percent ?? -Infinity))
    .slice(0, limit)
}

/** Symbols held by the most *distinct* players; ties broken alphabetically. */
function mostPopularSymbols(active, limit) {
  const holders = new Map() // symbol -> Set(user_id)
  for (const p of active) {
    for (const pos of positionsOf(p)) {
      if (!pos || !pos.symbol) continue
      const set = holders.get(pos.symbol) || new Set()
      set.add(p.user_id)
      holders.set(pos.symbol, set)
    }
  }
  return [...holders.entries()]
    .map(([symbol, set]) => ({ symbol, count: set.size }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol))
    .slice(0, limit)
    .map(x => x.symbol)
}

/** Rank #1 player by portfolio value; named, framed positively. */
function topPlayer(active, sammyReturn) {
  let top = null
  for (const p of active) {
    const v = portfolioValueOf(p)
    if (v == null) continue
    if (top == null || v > top.v) top = { p, v }
  }
  if (!top) return null
  const r = returnPercentOf(top.p)
  return {
    player: friendlyName(top.p),
    return_percent: round(r),
    beat_sammy_p: sammyReturn == null || r == null ? null : r > sammyReturn,
  }
}

function personalRecap(me, { sammyReturn, piggyReturn, end }) {
  const r = returnPercentOf(me)
  const beatSammy = sammyReturn == null || r == null ? null : r > sammyReturn
  const beatPiggy = piggyReturn == null || r == null ? null : r > piggyReturn

  // Their own best position (named to themselves is fine — it's private).
  let best = null
  for (const pos of positionsOf(me)) {
    const pr = toNum(pos.unrealized_gain_loss_percent)
    if (pr == null || !pos.symbol) continue
    if (best == null || pr > best.r) best = { symbol: pos.symbol, r: pr }
  }

  return {
    return_percent: round(r),
    beat_sammy_p: beatSammy,
    beat_piggy: beatPiggy,
    best_trade: best ? { symbol: best.symbol, return_percent: round(best.r) } : null,
    lessons_hook: lessonsHook({ beatSammy, beatPiggy, best }),
  }
}

/**
 * A short, fact-grounded seed for the model's "lesson" — positive/growth
 * framed. Kept factual (no invented history); richer hooks (held-through-a-dip
 * etc.) arrive once we feed trade history in a later phase.
 */
function lessonsHook({ beatSammy, beatPiggy, best }) {
  if (beatSammy) return 'you beat the market this round'
  if (beatPiggy) return 'you beat a savings account, even though the market edged ahead'
  if (best && best.r > 0) return `your best pick, ${best.symbol}, still finished up`
  return 'a tricky round — the market has these, and they teach the most'
}

/** Held days from purchase to the contest close; null when purchase_date is absent. */
function heldDays(pos, endDate) {
  const bought = toDate(pos.purchase_date)
  if (!bought) return null
  const ref = endDate || toDate(pos.updated_at) || new Date()
  return Math.max(0, Math.round((ref.getTime() - bought.getTime()) / MS_PER_DAY))
}

/**
 * Orchestrator: assemble the recap INPUT for a concluded contest by id.
 * Fetches the contest, its participants (all age groups) and the ghost
 * benchmark curves, then delegates to the pure builder.
 *
 * @param {string} contestId
 * @param {object} [opts]
 * @param {string} [opts.personalUserId]  emit a personal mini-recap for this user
 * @param {function} [opts.priceProvider] passed through to computeGhostRankings (tests inject)
 * @param {object}  [opts.deps]           service overrides (tests inject)
 */
async function assembleRecapInput(contestId, opts = {}) {
  const {
    personalUserId = null,
    priceProvider,
    deps = {},
  } = opts
  const contestService = deps.contestService || require('./contest.service')
  const benchmarkService = deps.benchmarkService || require('./benchmark.service')

  const contest = await contestService.getContest(contestId)
  if (!contest) throw new Error(`Contest not found: ${contestId}`)

  const participants = await contestService.getContestParticipants(contestId)

  // A benchmark failure must never break the recap — degrade to no ghosts.
  let benchmarks = []
  try {
    benchmarks = priceProvider
      ? await benchmarkService.computeGhostRankings(contest, priceProvider)
      : await benchmarkService.computeGhostRankings(contest)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recapInput] benchmark computation skipped:', err.message)
  }

  return buildRecapInput({ contest, participants, benchmarks, personalUserId })
}

module.exports = {
  buildRecapInput,
  assembleRecapInput,
  // exported for unit tests
  _internals: { median, shareAbove, friendlyName, topSectors, mostPopularSymbols },
}
