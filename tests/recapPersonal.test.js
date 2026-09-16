/**
 * Personal (per-kid) mini-recap tests (phase 4).
 *
 * Lazy generation gated on the published group recap, with the model call
 * injected so everything runs deterministically without credentials.
 */

process.env.BEANSTALK_ENVIRONMENT = 'test'

const request = require('supertest')
const express = require('express')
const recapService = require('../src/services/recap.service')
const memory = require('../src/services/_memory_store')

const contestService = memory.contest

function goodGroupRecap() {
  return {
    headline: 'A wild month!',
    market_recap: 'The market moved around a lot.',
    highlights: [{ emoji: '🚀', title: 'Nice', body: 'A bold pick.' }],
    benchmark_scoreboard: { line: 'Many beat the market!', beat_market_share: 0.9, beat_savings_share: 0.9 },
    lessons: ['Patience pays.'],
    cash_signoff: 'Keep growing! — Cash',
  }
}

function goodPersonalRecap() {
  return {
    headline: 'Nice work this month!',
    body: 'You stuck with your plan and it showed. Your best pick carried you.',
    lesson: 'Holding through the wobble paid off.',
    cash_signoff: 'Proud of you! — Cash 🌱',
  }
}

const benchmarkService = {
  computeGhostRankings: async () => [
    { user_id: 'ghost:spx', username: 'Sammy P.', benchmark: 'S&P 500', benchmark_symbol: 'SPY', return_percent: 5 },
    { user_id: 'ghost:cash', username: 'Piggy', benchmark: 'Savings', benchmark_symbol: null, return_percent: 1 },
  ],
}

const deps = { contestService, benchmarkService }

async function seedContestWithPlayer(userId, priceMap) {
  const created = await contestService.createContest('admin-personal', {
    name: 'Personal Cup',
    age_groups: ['high_school'],
    start_date: new Date(Date.now() - 40 * 86400000),
    end_date: new Date(Date.now() + 1 * 86400000),
    starting_balance: 10000,
    status: 'active',
  })
  const contestId = created.contest_id
  const p = await contestService.joinContest(contestId, userId, 'high_school')
  // All-in (100 sh × $100 = the full $10k balance) so the whole-portfolio
  // return tracks the position — makes the beat-market/savings flags clear.
  await memory.portfolio.executeBuyTrade(p.portfolio_snapshot_id, 'NVDA', 100, 100)
  await memory.portfolio.updatePortfolioPrices(p.portfolio_snapshot_id, priceMap)
  return contestId
}

describe('recap.service — validatePersonalRecap', () => {
  const input = { personal: { return_percent: 30, beat_sammy_p: true, beat_piggy: true } }

  test('pins the figures to the personal INPUT', () => {
    const out = recapService.validatePersonalRecap(goodPersonalRecap(), input)
    expect(out.your_return_percent).toBe(30)
    expect(out.beat_market).toBe(true)
    expect(out.beat_savings).toBe(true)
    expect(out.headline).toMatch(/nice work/i)
    expect(out.body).not.toBe('');
  })

  test('throws when a required field is missing', () => {
    const raw = goodPersonalRecap()
    delete raw.body
    expect(() => recapService.validatePersonalRecap(raw, input)).toThrow(/missing required field/i)
  })

  test('a losing player still gets a valid, encouraging recap (numbers pinned)', () => {
    const losing = { personal: { return_percent: -8, beat_sammy_p: false, beat_piggy: false } }
    const out = recapService.validatePersonalRecap(goodPersonalRecap(), losing)
    expect(out.your_return_percent).toBe(-8)
    expect(out.beat_market).toBe(false)
    expect(out.beat_savings).toBe(false)
  })
})

describe('recap.service — getOrGeneratePersonalRecap', () => {
  test('returns null until the group recap is published', async () => {
    const contestId = await seedContestWithPlayer('kid-1', { NVDA: 130 })
    // No group recap yet → null.
    expect(
      await recapService.getOrGeneratePersonalRecap(contestId, 'kid-1', { deps, callModel: async () => goodPersonalRecap() }),
    ).toBeNull()

    // Group draft exists but is NOT published → still null.
    await recapService.generateRecap(contestId, { callModel: async () => goodGroupRecap(), deps })
    expect(
      await recapService.getOrGeneratePersonalRecap(contestId, 'kid-1', { deps, callModel: async () => goodPersonalRecap() }),
    ).toBeNull()
  })

  test('generates lazily once published, is cached, and pins the numbers', async () => {
    const contestId = await seedContestWithPlayer('kid-2', { NVDA: 130 }) // +30%
    await recapService.generateRecap(contestId, { callModel: async () => goodGroupRecap(), deps })
    await recapService.publishRecap(contestId, { deps })

    let calls = 0
    const callModel = async (input) => {
      calls += 1
      // the personal INPUT branch is present and carries this kid's numbers
      expect(input.personal).toBeTruthy()
      expect(input.personal.return_percent).toBeGreaterThan(0)
      return goodPersonalRecap()
    }

    const rec = await recapService.getOrGeneratePersonalRecap(contestId, 'kid-2', { deps, callModel })
    expect(rec).not.toBeNull()
    expect(rec.user_id).toBe('kid-2')
    expect(rec.recap.beat_market).toBe(true) // beat Sammy P. (+5%) with +30%
    expect(rec.recap.beat_savings).toBe(true)
    expect(rec.recap.your_return_percent).toBeGreaterThan(0)
    expect(calls).toBe(1)

    // cached — no second model call
    const again = await recapService.getOrGeneratePersonalRecap(contestId, 'kid-2', { deps, callModel })
    expect(again.recap.headline).toBe(rec.recap.headline)
    expect(calls).toBe(1)
  })

  test('returns null for a user who was not a participant', async () => {
    const contestId = await seedContestWithPlayer('kid-3', { NVDA: 130 })
    await recapService.generateRecap(contestId, { callModel: async () => goodGroupRecap(), deps })
    await recapService.publishRecap(contestId, { deps })

    const rec = await recapService.getOrGeneratePersonalRecap(contestId, 'stranger', {
      deps, callModel: async () => goodPersonalRecap(),
    })
    expect(rec).toBeNull()
  })
})

describe('GET /api/contests/:id/recap/me — route', () => {
  function makeApp(userId) {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.user = { user_id: userId, role: 'user' }
      next()
    })
    app.use('/api', require('../src/routes/api/contest.route'))
    return app
  }

  test('404 before a personal recap exists, 200 with the cached one after', async () => {
    const contestId = await seedContestWithPlayer('kid-route', { NVDA: 130 })

    // Before the group recap is published, the route 404s.
    const app = makeApp('kid-route')
    const before = await request(app).get(`/api/contests/${contestId}/recap/me`)
    expect(before.status).toBe(404)

    // Publish the group recap and pre-generate the personal one (injected model)
    // so the route returns the cached record without a live model call.
    await recapService.generateRecap(contestId, { callModel: async () => goodGroupRecap(), deps })
    await recapService.publishRecap(contestId, { deps })
    await recapService.getOrGeneratePersonalRecap(contestId, 'kid-route', {
      deps, callModel: async () => goodPersonalRecap(),
    })

    const after = await request(app).get(`/api/contests/${contestId}/recap/me`)
    expect(after.status).toBe(200)
    expect(after.body.user_id).toBe('kid-route')
    expect(after.body.recap.headline).toMatch(/nice work/i)
    expect(after.body.recap.beat_market).toBe(true)
  })

  test('404 for a logged-in user who was not in the contest', async () => {
    const contestId = await seedContestWithPlayer('kid-in', { NVDA: 130 })
    await recapService.generateRecap(contestId, { callModel: async () => goodGroupRecap(), deps })
    await recapService.publishRecap(contestId, { deps })

    const app = makeApp('kid-out') // different user, not a participant
    const res = await request(app).get(`/api/contests/${contestId}/recap/me`)
    expect(res.status).toBe(404)
  })
})
