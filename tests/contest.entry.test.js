/**
 * Contest entry-requirements (learning gate) tests — in-memory store.
 *
 * Runs with BEANSTALK_ENVIRONMENT=test so contest.service is backed by the
 * in-memory store and no BigQuery credentials are needed. We mount just the
 * contest router (not the full src/app.js, which eagerly wires Firebase/Alpaca
 * at require time) behind a tiny middleware that injects an admin user — the
 * same role the real deployment's auth middleware sets on req.user.
 *
 * These cover the wire contract the admin console and mobile app rely on:
 * the nested `entry_requirements: { min_xp, required_lessons }` object round-
 * trips through create → list → detail → update, both requirements combine,
 * and an unset gate reads back as open.
 */

process.env.BEANSTALK_ENVIRONMENT = 'test'

const request = require('supertest')
const express = require('express')

// Inject an admin user (createContest/updateContest are admin-only) and a
// stable user_id used as the creator.
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

const app = makeApp()

function futureIso(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString()
}

async function createContest(overrides = {}) {
  const res = await request(app)
    .post('/api/contests')
    .send({
      name: 'Gate Test Contest',
      description: 'entry-requirements test',
      age_groups: ['high_school'],
      start_date: futureIso(1),
      end_date: futureIso(30),
      starting_balance: 10000,
      ...overrides,
    })
  expect(res.status).toBe(201)
  return res.body
}

describe('Contest entry requirements — create & read back', () => {
  test('a contest with no gate reads back as open (min_xp 0, no lessons)', async () => {
    const created = await createContest()
    expect(created.entry_requirements).toEqual({ min_xp: 0, required_lessons: [] })

    const detail = await request(app).get(`/api/contests/${created.contest_id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.entry_requirements).toEqual({ min_xp: 0, required_lessons: [] })
  })

  test('stores a combined XP + lessons gate and returns it nested', async () => {
    const created = await createContest({
      entry_requirements: { min_xp: 300, required_lessons: ['l5', 'l6'] },
    })
    expect(created.entry_requirements).toEqual({
      min_xp: 300,
      required_lessons: ['l5', 'l6'],
    })

    const detail = await request(app).get(`/api/contests/${created.contest_id}`)
    expect(detail.body.entry_requirements).toEqual({
      min_xp: 300,
      required_lessons: ['l5', 'l6'],
    })
  })

  test('an XP-only gate leaves required_lessons empty', async () => {
    const created = await createContest({
      entry_requirements: { min_xp: 150 },
    })
    expect(created.entry_requirements).toEqual({ min_xp: 150, required_lessons: [] })
  })

  test('a lessons-only gate leaves min_xp at 0', async () => {
    const created = await createContest({
      entry_requirements: { required_lessons: ['l1'] },
    })
    expect(created.entry_requirements).toEqual({ min_xp: 0, required_lessons: ['l1'] })
  })

  test('sanitizes junk: negative XP → 0, de-dupes and trims lesson ids', async () => {
    const created = await createContest({
      entry_requirements: { min_xp: -50, required_lessons: ['l5', 'l5', ' l6 ', '', 7] },
    })
    expect(created.entry_requirements).toEqual({
      min_xp: 0,
      required_lessons: ['l5', 'l6'],
    })
  })
})

describe('Contest entry requirements — list endpoint', () => {
  test('list response carries entry_requirements for each contest', async () => {
    const created = await createContest({
      entry_requirements: { min_xp: 500, required_lessons: ['l2'] },
    })
    const list = await request(app).get('/api/contests')
    expect(list.status).toBe(200)
    const row = list.body.contests.find(c => c.contest_id === created.contest_id)
    expect(row).toBeDefined()
    expect(row.entry_requirements).toEqual({ min_xp: 500, required_lessons: ['l2'] })
  })
})

describe('Contest entry requirements — update endpoint', () => {
  test('PUT sets a gate on a previously open contest', async () => {
    const created = await createContest()
    expect(created.entry_requirements).toEqual({ min_xp: 0, required_lessons: [] })

    const updated = await request(app)
      .put(`/api/contests/${created.contest_id}`)
      .send({ entry_requirements: { min_xp: 200, required_lessons: ['l3', 'l4'] } })
    expect(updated.status).toBe(200)
    expect(updated.body.entry_requirements).toEqual({
      min_xp: 200,
      required_lessons: ['l3', 'l4'],
    })

    const detail = await request(app).get(`/api/contests/${created.contest_id}`)
    expect(detail.body.entry_requirements).toEqual({
      min_xp: 200,
      required_lessons: ['l3', 'l4'],
    })
  })

  test('PUT that omits entry_requirements leaves the existing gate untouched', async () => {
    const created = await createContest({
      entry_requirements: { min_xp: 100, required_lessons: ['l1'] },
    })

    const updated = await request(app)
      .put(`/api/contests/${created.contest_id}`)
      .send({ description: 'edited copy only' })
    expect(updated.status).toBe(200)
    expect(updated.body.entry_requirements).toEqual({
      min_xp: 100,
      required_lessons: ['l1'],
    })
  })

  test('PUT can clear a gate back to open', async () => {
    const created = await createContest({
      entry_requirements: { min_xp: 100, required_lessons: ['l1'] },
    })

    const updated = await request(app)
      .put(`/api/contests/${created.contest_id}`)
      .send({ entry_requirements: { min_xp: 0, required_lessons: [] } })
    expect(updated.status).toBe(200)
    expect(updated.body.entry_requirements).toEqual({ min_xp: 0, required_lessons: [] })
  })
})
