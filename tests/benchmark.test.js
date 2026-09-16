/**
 * Ghost benchmark player tests (PROTOTYPE — Sammy P./S&P 500).
 *
 * The compute logic is unit-tested with an injected price provider so it runs
 * without live market data. A light integration test confirms the leaderboard
 * endpoint returns a `benchmarks` array and degrades gracefully (empty) when
 * no market data is available, as in the in-memory test environment.
 */

process.env.BEANSTALK_ENVIRONMENT = 'test'

const request = require('supertest')
const express = require('express')
const benchmarkService = require('../src/services/benchmark.service')

const contest = { starting_balance: 10000, start_date: new Date('2026-01-01') }

describe('benchmark.service — Sammy P. buy-and-hold curve', () => {
  // Piggy is deterministic and always present, so these Sammy-P.-focused tests
  // target the SPY ghost specifically rather than the whole array.
  const sammy = (ghosts) => ghosts.find(g => g.user_id === 'ghost:spx')

  test('computes value and return from a price curve (SPY 400 → 460 = +15%)', async () => {
    // SPY-only stub so this stays focused on Sammy P.; other index ghosts skip.
    const provider = async (symbol) =>
      symbol === 'SPY' ? { startPrice: 400, currentPrice: 460 } : { startPrice: null, currentPrice: null }
    const ghosts = await benchmarkService.computeGhostRankings(contest, provider)

    // Only Sammy P. (priced) and Piggy (deterministic) compute here.
    expect(ghosts.map(g => g.user_id).sort()).toEqual(['ghost:cash', 'ghost:spx'])
    const g = sammy(ghosts)
    expect(g.username).toBe('Sammy P.')
    expect(g.benchmark).toBe('S&P 500')
    expect(g.benchmark_symbol).toBe('SPY')
    expect(g.is_ghost).toBe(true)
    expect(g.position_count).toBe(1)
    expect(g.portfolio_value).toBeCloseTo(11500, 6)
    expect(g.return_percent).toBeCloseTo(15, 6)
  })

  test('a down market yields a loss (500 → 450 = -10%)', async () => {
    const provider = async () => ({ startPrice: 500, currentPrice: 450 })
    const g = sammy(await benchmarkService.computeGhostRankings(contest, provider))
    expect(g.portfolio_value).toBeCloseTo(9000, 6)
    expect(g.return_percent).toBeCloseTo(-10, 6)
  })

  test('skips Sammy P. when price data is unavailable (Piggy still computes)', async () => {
    const provider = async () => ({ startPrice: null, currentPrice: null })
    const ghosts = await benchmarkService.computeGhostRankings(contest, provider)
    expect(sammy(ghosts)).toBeUndefined()
    expect(ghosts.map(g => g.user_id)).toEqual(['ghost:cash'])
  })

  test('skips Sammy P. when start price is zero (no divide-by-zero)', async () => {
    const provider = async () => ({ startPrice: 0, currentPrice: 100 })
    expect(sammy(await benchmarkService.computeGhostRankings(contest, provider))).toBeUndefined()
  })

  test('a price-provider error never breaks the board (Sammy P. skipped, Piggy stays)', async () => {
    const provider = async () => { throw new Error('market data boom') }
    const ghosts = await benchmarkService.computeGhostRankings(contest, provider)
    expect(sammy(ghosts)).toBeUndefined()
    expect(ghosts.map(g => g.user_id)).toEqual(['ghost:cash'])
  })

  test('no ghosts at all for a zero / missing starting balance', async () => {
    const provider = async () => ({ startPrice: 400, currentPrice: 460 })
    expect(await benchmarkService.computeGhostRankings({ starting_balance: 0, start_date: new Date() }, provider)).toEqual([])
    expect(await benchmarkService.computeGhostRankings(null, provider)).toEqual([])
  })

  test('the full five-ghost roster is active', () => {
    const active = benchmarkService.GHOST_BENCHMARKS.filter(g => g.active)
    expect(active.map(g => g.username).sort()).toEqual(
      ['Downey Jones', 'Nadia Q.', 'Piggy', 'Rusty', 'Sammy P.']
    )
  })

  test('all four index ghosts compute from priced curves (+ Piggy)', async () => {
    // Distinct curve per symbol so returns differ and ranking is meaningful.
    const curves = {
      SPY: { startPrice: 400, currentPrice: 460 }, // +15%  Sammy P.
      DIA: { startPrice: 350, currentPrice: 385 }, // +10%  Downey Jones
      QQQ: { startPrice: 400, currentPrice: 480 }, // +20%  Nadia Q.
      IWM: { startPrice: 200, currentPrice: 190 }, // −5%   Rusty
    }
    const provider = async (symbol) => curves[symbol] || { startPrice: null, currentPrice: null }
    const ghosts = await benchmarkService.computeGhostRankings(contest, provider)

    const by = Object.fromEntries(ghosts.map(g => [g.user_id, g]))
    expect(Object.keys(by).sort()).toEqual(
      ['ghost:cash', 'ghost:dow', 'ghost:ndx', 'ghost:rut', 'ghost:spx']
    )
    expect(by['ghost:spx'].return_percent).toBeCloseTo(15, 6)
    expect(by['ghost:dow'].return_percent).toBeCloseTo(10, 6)
    expect(by['ghost:ndx'].return_percent).toBeCloseTo(20, 6)
    expect(by['ghost:rut'].return_percent).toBeCloseTo(-5, 6)
    expect(by['ghost:dow'].benchmark).toBe('Dow Jones')
    expect(by['ghost:ndx'].benchmark_symbol).toBe('QQQ')
    expect(by['ghost:rut'].username).toBe('Rusty')
  })
})

describe('benchmark.service — Piggy savings baseline', () => {
  const provider = async () => ({ startPrice: 400, currentPrice: 460 }) // Sammy P. +15%

  test('compounds the savings APY over the elapsed contest window (~1 year → +4%)', async () => {
    const oneYearAgo = { starting_balance: 10000, start_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
    const ghosts = await benchmarkService.computeGhostRankings(oneYearAgo, provider)

    const piggy = ghosts.find(g => g.user_id === 'ghost:cash')
    expect(piggy).toBeDefined()
    expect(piggy.username).toBe('Piggy')
    expect(piggy.benchmark).toBe('Savings')
    expect(piggy.benchmark_symbol).toBeNull()
    expect(piggy.position_count).toBe(0)
    // (1 + 0.04)^(365/365) = 1.04 → 10400, +4%
    expect(piggy.portfolio_value).toBeCloseTo(10400, 0)
    expect(piggy.return_percent).toBeCloseTo(4, 1)
  })

  test('is flat (0%) for a contest that has not started yet', async () => {
    const future = { starting_balance: 10000, start_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }
    const [piggy] = (await benchmarkService.computeGhostRankings(future, provider))
      .filter(g => g.user_id === 'ghost:cash')
    expect(piggy.portfolio_value).toBeCloseTo(10000, 6)
    expect(piggy.return_percent).toBeCloseTo(0, 6)
  })

  test('Piggy computes even when the market ghost has no data (deterministic)', async () => {
    const noData = async () => ({ startPrice: null, currentPrice: null }) // Sammy P. skipped
    const past = { starting_balance: 10000, start_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
    const ghosts = await benchmarkService.computeGhostRankings(past, noData)
    expect(ghosts.map(g => g.user_id)).toEqual(['ghost:cash']) // only Piggy
  })

  test('ghostFactor: half a year of savings compounds correctly', async () => {
    const contest = { start_date: new Date(Date.now() - 182.5 * 24 * 60 * 60 * 1000) }
    const factor = await benchmarkService.ghostFactor(
      { apy: 0.04 }, contest, provider,
    )
    expect(factor).toBeCloseTo(Math.pow(1.04, 0.5), 6)
  })
})

describe('GET /api/contests/:id/leaderboard — benchmarks field', () => {
  function makeApp() {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.user = { user_id: 'admin-test-user', role: 'admin' }
      next()
    })
    app.use('/api', require('../src/routes/api/contest.route'))
    return app
  }

  test('leaderboard response carries benchmarks — Piggy present, Sammy P. skipped without market data', async () => {
    const app = makeApp()
    const created = await request(app)
      .post('/api/contests')
      .send({
        name: 'Ghost Benchmark Test',
        age_groups: ['high_school'],
        start_date: new Date(Date.now() + 86400000).toISOString(), // starts tomorrow
        end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        starting_balance: 10000,
      })
    expect(created.status).toBe(201)

    const res = await request(app).get(`/api/contests/${created.body.contest_id}/leaderboard`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.benchmarks)).toBe(true)

    // Piggy is deterministic (no market data needed) so she always appears;
    // Sammy P. is skipped in the credential-less test env (not errored).
    const ids = res.body.benchmarks.map(b => b.user_id)
    expect(ids).toEqual(['ghost:cash'])
    const piggy = res.body.benchmarks[0]
    expect(piggy.username).toBe('Piggy')
    expect(piggy.is_ghost).toBe(true)
    // Contest hasn't started → flat baseline at the starting balance.
    expect(piggy.portfolio_value).toBeCloseTo(10000, 6)
    expect(piggy.return_percent).toBeCloseTo(0, 6)
  })
})
