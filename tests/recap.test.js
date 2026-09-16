/**
 * Contest Recap generator tests (phase 2).
 *
 * The model call is injected (`callModel`) so the whole pipeline — INPUT
 * assembly, validation, storage, the admin generate → publish flow, and the
 * public GET — runs deterministically with no credentials and no network.
 */

process.env.BEANSTALK_ENVIRONMENT = 'test'

const request = require('supertest')
const express = require('express')
const recapService = require('../src/services/recap.service')
const memory = require('../src/services/_memory_store')

const contestService = memory.contest

// A well-formed model response (as the model would return, already parsed).
function goodRecap() {
  return {
    headline: 'A wild month — and some of you rode it beautifully!',
    market_recap: 'The market bounced around, but the trend was up over the window.',
    highlights: [
      { emoji: '🚀', title: 'Trade of the month', body: 'A bold pick that paid off.' },
      { emoji: '🌱', title: 'Steady wins', body: 'Patience did some quiet work too.' },
    ],
    benchmark_scoreboard: {
      line: 'Lots of you beat the market, and even more beat the piggy bank!',
      beat_market_share: 0.99, // deliberately WRONG — validator must pin to INPUT
      beat_savings_share: 0.99,
    },
    lessons: ['Time in the market beat timing the market this round.'],
    cash_signoff: 'Keep growing, investors! — Cash 🌱',
  }
}

// Stand up a contest with a couple of trading players in the in-memory store.
async function seedContest() {
  const created = await contestService.createContest('admin-recap', {
    name: 'Recap Cup',
    age_groups: ['high_school'],
    start_date: new Date(Date.now() - 40 * 86400000),
    end_date: new Date(Date.now() + 1 * 86400000), // registration open so joins work
    starting_balance: 10000,
    status: 'active',
  })
  const contestId = created.contest_id

  const p1 = await contestService.joinContest(contestId, 'recap-winner', 'high_school')
  await memory.portfolio.executeBuyTrade(p1.portfolio_snapshot_id, 'NVDA', 10, 100)
  await memory.portfolio.updatePortfolioPrices(p1.portfolio_snapshot_id, { NVDA: 130 }) // +30%

  const p2 = await contestService.joinContest(contestId, 'recap-runner', 'high_school')
  await memory.portfolio.executeBuyTrade(p2.portfolio_snapshot_id, 'AAPL', 10, 100)
  await memory.portfolio.updatePortfolioPrices(p2.portfolio_snapshot_id, { AAPL: 98 }) // -2%

  return contestId
}

// A fixed benchmark roster so beat-shares are deterministic in tests.
const benchmarkService = {
  computeGhostRankings: async () => [
    { user_id: 'ghost:spx', username: 'Sammy P.', benchmark: 'S&P 500', benchmark_symbol: 'SPY', return_percent: 5 },
    { user_id: 'ghost:cash', username: 'Piggy', benchmark: 'Savings', benchmark_symbol: null, return_percent: 1 },
  ],
}

describe('recap.service — validateRecap', () => {
  const input = { field: { share_that_beat_sammy_p: 0.5, share_that_beat_piggy: 0.5 } }

  test('pins the scoreboard shares to the INPUT, ignoring the model’s numbers', () => {
    const out = recapService.validateRecap(goodRecap(), input)
    expect(out.benchmark_scoreboard.beat_market_share).toBe(0.5)
    expect(out.benchmark_scoreboard.beat_savings_share).toBe(0.5)
    // the model's narration line is preserved
    expect(out.benchmark_scoreboard.line).toMatch(/beat the market/i)
  })

  test('keeps well-formed highlights and drops malformed ones', () => {
    const raw = goodRecap()
    raw.highlights.push({ emoji: '💥', title: '', body: 'no title' }) // dropped
    raw.highlights.push({ title: 'No emoji ok', body: 'defaults an emoji' }) // kept, default emoji
    const out = recapService.validateRecap(raw, input)
    expect(out.highlights).toHaveLength(3)
    expect(out.highlights[2].emoji).toBe('✨')
  })

  test('throws when a required field is missing', () => {
    const raw = goodRecap()
    delete raw.headline
    expect(() => recapService.validateRecap(raw, input)).toThrow(/missing required field/i)
  })

  test('parses a JSON string wrapped in prose / code fences', () => {
    const text = 'Here you go:\n```json\n' + JSON.stringify(goodRecap()) + '\n```\nHope that helps!'
    const out = recapService.validateRecap(text, input)
    expect(out.headline).toMatch(/wild month/i)
  })

  test('throws on a response with no JSON object', () => {
    expect(() => recapService.extractRecapObject('sorry, I cannot do that'))
      .toThrow(/did not contain a JSON object/i)
  })
})

describe('recap.service — generate / publish flow', () => {
  test('generates a draft, is idempotent, and force regenerates', async () => {
    const contestId = await seedContest()
    let calls = 0
    const callModel = async (input) => {
      calls += 1
      // sanity: the INPUT the generator built is well-formed and verified
      expect(input.contest.name).toBe('Recap Cup')
      expect(input.field.share_that_beat_sammy_p).not.toBeNull()
      return goodRecap()
    }
    const deps = { contestService, benchmarkService }

    const draft = await recapService.generateRecap(contestId, { callModel, deps, model: 'test-model' })
    expect(draft.status).toBe('draft')
    expect(draft.model).toBe('test-model')
    expect(draft.recap.headline).toMatch(/wild month/i)
    // scoreboard numbers came from the verified INPUT, not the model
    expect(draft.recap.benchmark_scoreboard.beat_market_share).not.toBe(0.99)
    expect(calls).toBe(1)

    // idempotent — no second model call
    const again = await recapService.generateRecap(contestId, { callModel, deps })
    expect(again.status).toBe('draft')
    expect(calls).toBe(1)

    // force → regenerates
    await recapService.generateRecap(contestId, { callModel, deps, force: true })
    expect(calls).toBe(2)
  })

  test('publish flips draft → published; getPublishedRecap gates on it', async () => {
    const contestId = await seedContest()
    const deps = { contestService, benchmarkService }

    // not published yet → nothing public
    await recapService.generateRecap(contestId, { callModel: async () => goodRecap(), deps })
    expect(await recapService.getPublishedRecap(contestId, { deps })).toBeNull()

    const published = await recapService.publishRecap(contestId, { deps })
    expect(published.status).toBe('published')
    expect(published.published_at).toBeTruthy()

    const pub = await recapService.getPublishedRecap(contestId, { deps })
    expect(pub).not.toBeNull()
    expect(pub.recap.headline).toMatch(/wild month/i)
  })

  test('publish throws when there is no recap', async () => {
    const contestId = await seedContest()
    await expect(
      recapService.publishRecap(contestId, { deps: { contestService, benchmarkService } }),
    ).rejects.toMatchObject({ code: 'RECAP_NOT_FOUND' })
  })
})

describe('recap endpoints — routes (in-memory store)', () => {
  // Real store + real recap.service; only the model call and the auth user are
  // injected. The generate route uses the real recap.service, which pulls
  // benchmarks via the real benchmark.service — Piggy is deterministic, index
  // ghosts are skipped without market creds. So we stub the model but not deps.
  function makeApp(role) {
    // Deterministic model output via a jest spy on the default model call.
    jest.spyOn(recapService, 'generateRecap')
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.user = { user_id: 'admin-1', role }
      next()
    })
    app.use('/api', require('../src/routes/api/contest.route'))
    return app
  }

  afterEach(() => jest.restoreAllMocks())

  test('non-admin cannot generate (403)', async () => {
    const app = makeApp('user')
    const created = await request(app).post('/api/contests').send({
      name: 'Perms', age_groups: ['high_school'],
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 86400000).toISOString(),
      starting_balance: 10000,
    })
    // createContest itself requires admin — use the service directly to seed.
    const contestId = created.body.contest_id || (await seedContest())
    const res = await request(app).post(`/api/contests/${contestId}/recap/generate`)
    expect(res.status).toBe(403)
  })

  test('public GET 404s until a recap is published, then returns it', async () => {
    const contestId = await seedContest()

    // Seed a published recap directly through the service (deterministic model).
    await recapService.generateRecap(contestId, {
      callModel: async () => goodRecap(),
      deps: { contestService, benchmarkService },
    })

    const app = makeApp('user') // public GET doesn't need admin
    const before = await request(app).get(`/api/contests/${contestId}/recap`)
    expect(before.status).toBe(404)

    await recapService.publishRecap(contestId, { deps: { contestService, benchmarkService } })

    const after = await request(app).get(`/api/contests/${contestId}/recap`)
    expect(after.status).toBe(200)
    expect(after.body.status).toBe('published')
    expect(after.body.recap.headline).toMatch(/wild month/i)
  })
})
