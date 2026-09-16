/**
 * Auto-generate-on-conclude tests (recap phase 2 wiring).
 *
 * Concluding a contest fires a best-effort, fire-and-forget recap DRAFT. It's
 * gated on ANTHROPIC_API_KEY (so it never attempts a network call in test/demo)
 * and on RECAP_AUTO_GENERATE. Here the model call is never reached — we spy on
 * recapService.generateRecap to assert the wiring, and confirm concluding
 * always succeeds regardless.
 */

process.env.BEANSTALK_ENVIRONMENT = 'test'

const request = require('supertest')
const express = require('express')
const recapService = require('../src/services/recap.service')
const memory = require('../src/services/_memory_store')

const contestService = memory.contest

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { user_id: 'admin-autogen', role: 'admin' }
    next()
  })
  app.use('/api', require('../src/routes/api/contest.route'))
  return app
}

async function seedActiveContest() {
  const created = await contestService.createContest('admin-autogen', {
    name: 'Autogen Cup',
    age_groups: ['high_school'],
    start_date: new Date(Date.now() - 10 * 86400000),
    end_date: new Date(Date.now() - 1 * 86400000),
    starting_balance: 10000,
    status: 'active',
  })
  return created.contest_id
}

/** Let the fire-and-forget microtasks run. */
const flush = () => new Promise(resolve => setImmediate(resolve))

describe('conclude → auto-generate recap draft', () => {
  const savedKey = process.env.ANTHROPIC_API_KEY
  const savedFlag = process.env.RECAP_AUTO_GENERATE

  afterEach(() => {
    jest.restoreAllMocks()
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = savedKey
    if (savedFlag === undefined) delete process.env.RECAP_AUTO_GENERATE
    else process.env.RECAP_AUTO_GENERATE = savedFlag
  })

  test('without an API key, concluding succeeds and does NOT attempt generation', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const spy = jest.spyOn(recapService, 'generateRecap')

    const contestId = await seedActiveContest()
    const res = await request(makeApp()).post(`/api/contests/${contestId}/conclude`)
    await flush()

    expect(res.status).toBe(200)
    expect(spy).not.toHaveBeenCalled()
  })

  test('with a key, concluding fires a best-effort generateRecap for the contest', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    delete process.env.RECAP_AUTO_GENERATE
    const spy = jest.spyOn(recapService, 'generateRecap').mockResolvedValue({ status: 'draft' })

    const contestId = await seedActiveContest()
    const res = await request(makeApp()).post(`/api/contests/${contestId}/conclude`)
    await flush()

    expect(res.status).toBe(200) // conclude response doesn't wait on the recap
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(contestId)
  })

  test('a generation failure never affects the conclude response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const spy = jest.spyOn(recapService, 'generateRecap').mockRejectedValue(new Error('model boom'))

    const contestId = await seedActiveContest()
    const res = await request(makeApp()).post(`/api/contests/${contestId}/conclude`)
    await flush()

    expect(res.status).toBe(200) // still 200 despite the rejected recap
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('RECAP_AUTO_GENERATE=false disables it even with a key', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.RECAP_AUTO_GENERATE = 'false'
    const spy = jest.spyOn(recapService, 'generateRecap')

    const contestId = await seedActiveContest()
    const res = await request(makeApp()).post(`/api/contests/${contestId}/conclude`)
    await flush()

    expect(res.status).toBe(200)
    expect(spy).not.toHaveBeenCalled()
  })
})
