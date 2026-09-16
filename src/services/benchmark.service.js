/**
 * Benchmark ("ghost player") service — PROTOTYPE
 *
 * Adds read-only buy-and-hold benchmark players to a contest so kids can see
 * whether their active trading beat "just leaving the money alone". See
 * Design/Contest-Recap-AI-Plan.md for the full vision (roster: Downey Jones,
 * Sammy P., Nadia Q., Rusty, Piggy).
 *
 * This prototype activates ONE ghost — **Sammy P.** (S&P 500, tracked via the
 * SPY ETF) — to prove the data path end to end. A ghost's value at time t is a
 * simple priced curve, no trades:
 *
 *     value(t) = starting_balance × (price_t / price_start)
 *
 * where price_start is the benchmark's close on/around the contest start date
 * and price_t is the latest close. return_percent is (price_t/price_start − 1).
 *
 * Price data is fetched through an injectable `priceProvider` so this is unit-
 * testable without live market data; the default provider uses the Alpaca
 * service. Any ghost whose prices can't be resolved is simply omitted (a
 * missing benchmark must never break the leaderboard).
 */

const alpacaService = require('./alpaca.service')

// Ghost roster. Only `active` ghosts are computed; the rest are the planned
// roster (see the design doc) and are here for when we expand the prototype.
// Piggy (savings baseline) has no symbol — it'll use a flat rate, added later.
const GHOST_BENCHMARKS = [
  { id: 'ghost:spx', username: 'Sammy P.', symbol: 'SPY',  label: 'S&P 500',      active: true },
  { id: 'ghost:dow', username: 'Downey Jones', symbol: 'DIA', label: 'Dow Jones', active: false },
  { id: 'ghost:ndx', username: 'Nadia Q.', symbol: 'QQQ',  label: 'NASDAQ-100',   active: false },
  { id: 'ghost:rut', username: 'Rusty',    symbol: 'IWM',  label: 'Russell 2000', active: false },
  // { id: 'ghost:cash', username: 'Piggy', symbol: null, label: 'Savings', active: false },
]

const MS_PER_DAY = 24 * 60 * 60 * 1000

function toDate(v) {
  if (v instanceof Date) return v
  if (v && typeof v === 'object' && v.value) return new Date(v.value)
  return new Date(v)
}

/**
 * Default price provider: resolves { startPrice, currentPrice } for a symbol
 * using the Alpaca service. startPrice is the daily close on/before the
 * contest start; currentPrice is the latest close. Returns nulls the caller
 * can skip on when data isn't available.
 */
async function defaultPriceProvider(symbol, startDate) {
  // Latest close.
  let currentPrice = null
  try {
    const priceMap = await alpacaService.getPriceMap([symbol])
    currentPrice = priceMap[symbol] ?? null
  } catch (_) { /* leave null */ }

  // Start close: pull enough daily bars to reach the start date, then take the
  // last bar on/before it. Bars come back oldest→newest.
  let startPrice = null
  try {
    const start = toDate(startDate)
    const spanDays = Math.ceil((Date.now() - start.getTime()) / MS_PER_DAY)
    // `spanDays` calendar days back needs at most `spanDays` trading bars
    // (trading days ≤ calendar days), plus a small buffer; cap for safety.
    const limit = Math.min(Math.max(spanDays + 5, 5), 1000)
    const bars = await alpacaService.getBars(symbol, '1Day', limit)
    for (const bar of bars) {
      if (toDate(bar.t) <= start) startPrice = bar.c
    }
    // Contest hasn't started yet, or bars don't reach it → fall back to the
    // earliest bar we have so the curve is still anchored to something real.
    if (startPrice == null && bars.length > 0) startPrice = bars[0].c
  } catch (_) { /* leave null */ }

  return { startPrice, currentPrice }
}

/**
 * Compute ghost-player leaderboard entries for a contest.
 *
 * @param {object} contest         - contest record (needs starting_balance, start_date)
 * @param {function} priceProvider - async (symbol, startDate) => { startPrice, currentPrice }
 * @returns {Promise<Array>} ranking-shaped ghost entries (unranked; caller ranks)
 */
async function computeGhostRankings(contest, priceProvider = defaultPriceProvider) {
  if (!contest) return []
  const startingBalance = Number(contest.starting_balance) || 0
  if (startingBalance <= 0) return []

  const ghosts = GHOST_BENCHMARKS.filter(g => g.active && g.symbol)

  const results = await Promise.all(ghosts.map(async (g) => {
    try {
      const { startPrice, currentPrice } = await priceProvider(g.symbol, contest.start_date)
      if (!startPrice || !currentPrice || startPrice <= 0) return null

      const factor = currentPrice / startPrice
      const value = startingBalance * factor
      const returnPercent = (factor - 1) * 100

      return {
        // Prefixed, non-UUID id so it never collides with a real user and the
        // mobile client won't flag it as "you".
        user_id: g.id,
        username: g.username,
        portfolio_value: value,
        return_percent: returnPercent,
        position_count: 1,
        best_performing_position: g.symbol,
        best_position_return_percent: returnPercent,
        last_trade_date: null,
        // Ghost metadata so clients can badge/label these rows distinctly.
        is_ghost: true,
        benchmark: g.label,
        benchmark_symbol: g.symbol,
      }
    } catch (_) {
      return null // never let a benchmark failure break the leaderboard
    }
  }))

  return results.filter(Boolean)
}

module.exports = {
  GHOST_BENCHMARKS,
  computeGhostRankings,
  defaultPriceProvider,
}
