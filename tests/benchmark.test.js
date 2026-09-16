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
  test('computes value and return from a price curve (SPY 400 → 460 = +15%)', async () => {
    const provider = async () => ({ startPrice: 400, currentPrice: 460 })
    const ghosts = await benchmarkService.computeGhostRankings(contest, provider)

    expect(ghosts).toHaveLength(1)
    const g = ghosts[0]
    expect(g.user_id).toBe('ghost:spx')
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
    const [g] = await benchmarkService.computeGhostRankings(contest, provider)
    expect(g.portfolio_value).toBeCloseTo(9000, 6)
    expect(g.return_percent).toBeCloseTo(-10, 6)
  })

  test('skips the ghost when price data is unavailable', async () => {
    const provider = async () => ({ startPrice: null, currentPrice: null })
    expect(await benchmarkService.computeGhostRankings(contest, provider)).toEqual([])
  })

  test('skips when start price is zero (no divide-by-zero)', async () => {
    const provider = async () => ({ startPrice: 0, currentPrice: 100 })
    expect(await benchmarkService.computeGhostRankings(contest, provider)).toEqual([])
  })

  test('a provider error never breaks the board', async () => {
    const provider = async () => { throw new Error('market data boom') }
    expect(await benchmarkService.computeGhostRankings(contest, provider)).toEqual([])
  })

  test('no ghosts for a zero / missing starting balance', async () => {
    const provider = async () => ({ startPrice: 400, currentPrice: 460 })
    expect(await benchmarkService.computeGhostRankings({ starting_balance: 0, start_date: new Date() }, provider)).toEqual([])
    expect(await benchmarkService.computeGhostRankings(null, provider)).toEqual([])
  })

  test('only Sammy P. is active in the prototype roster', () => {
    const active = benchmarkService.GHOST_BENCHMARKS.filter(g => g.active)
    expect(active.map(g => g.username)).toEqual(['Sammy P.'])
    // The rest of the planned roster is present but inactive for now.
    expect(benchmarkService.GHOST_BENCHMARKS.map(g => g.username)).toEqual(
      expect.arrayContaining(['Sammy P.', 'Downey Jones', 'Nadia Q.', 'Rusty'])
    )
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

  test('leaderboard response carries a benchmarks array (empty when no market data)', async () => {
    const app = makeApp()
    const created = await request(app)
      .post('/api/contests')
      .send({
        name: 'Ghost Benchmark Test',
        age_groups: ['high_school'],
        start_date: new Date(Date.now() + 86400000).toISOString(),
        end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        starting_balance: 10000,
      })
    expect(created.status).toBe(201)

    const res = await request(app).get(`/api/contests/${created.body.contest_id}/leaderboard`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('benchmarks')
    expect(Array.isArray(res.body.benchmarks)).toBe(true)
    // No Alpaca creds in the test env → the ghost is skipped, not errored.
    expect(res.body.benchmarks).toEqual([])
  })
})
