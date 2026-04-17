#!/usr/bin/env node
/**
 * Beanstalk Demo Seed Script
 *
 * Creates a rich demo environment with users, contests at every lifecycle
 * stage, populated portfolios, and leaderboards.
 *
 * Usage:
 *   # Local (in-process, using _memory_store directly — fastest):
 *   node scripts/seed-demo.js
 *   npm run seed:demo
 *   BEANSTALK_ENVIRONMENT=demo   # auto-runs on server boot
 *
 *   # Remote (HTTP against any running API, e.g. Fly.io):
 *   BASE_URL=https://beanstalk-api.fly.dev npm run seed:demo
 *   BASE_URL=http://localhost:8080 npm run seed:demo
 *
 * When BASE_URL is set, the script talks to the API over HTTP — this is the
 * mode to use against deployed environments (Fly.io, staging). When BASE_URL
 * is unset, it imports the in-memory store directly, which only works against
 * a co-located server.
 *
 * Idempotent: checks if demo users already exist before seeding.
 * All demo accounts use password: Demo123!
 */

require('dotenv').config()

const DEMO_PASSWORD = 'Demo123!'
// When running as a CLI, BASE_URL defaults to the local dev server on :8080.
// Override for deployed environments, e.g.
//   BASE_URL=https://beanstalk-api.fly.dev npm run seed:demo
// When required by server boot (BEANSTALK_ENVIRONMENT=demo), BASE_URL is
// left unset so the in-process seedLocal() path is used — see entrypoint.
const BASE_URL_DEFAULT = 'http://localhost:8080'
const BASE_URL = process.env.BASE_URL
  || (require.main === module ? BASE_URL_DEFAULT : null)

// ── Date helpers ──────────────────────────────────────────────────────────
const now = new Date()
const daysAgo = (n) => new Date(now.getTime() - n * 86400000)
const daysFromNow = (n) => new Date(now.getTime() + n * 86400000)

// Current-ish market prices for gain/loss calculations
const marketPrices = {
  AAPL: 204, MSFT: 418, NVDA: 510, TSLA: 387, GOOGL: 178,
  META: 673, AMZN: 198, COIN: 228, AMD: 165, PLTR: 28,
  SPY: 535, QQQ: 455, NFLX: 645, DIS: 118,
}

// ══════════════════════════════════════════════════════════════════════════
// HTTP client — used when BASE_URL is set
// ══════════════════════════════════════════════════════════════════════════
async function httpRequest(method, path, { body, token } = {}) {
  const url = `${BASE_URL}${path}`
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = text }

  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${data?.error || text}`)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

// Try to log in; returns token or null (does not throw on 401).
async function tryLogin(email, password) {
  try {
    const res = await httpRequest('POST', '/api/auth/login', {
      body: { email, password },
    })
    return { token: res.token, user_id: res.user_id, name: res.name }
  } catch (err) {
    if (err.status === 401 || err.status === 404) return null
    throw err
  }
}

// Register a user; if 409 (already exists), log in instead to get a token.
async function registerOrLogin(name, email, password) {
  try {
    const res = await httpRequest('POST', '/api/auth/register', {
      body: { name, email, password },
    })
    return { token: res.token, user_id: res.user_id, name: res.name }
  } catch (err) {
    if (err.status === 409) {
      const login = await tryLogin(email, password)
      if (login) return login
    }
    throw err
  }
}

// ══════════════════════════════════════════════════════════════════════════
// REMOTE SEED (HTTP)
// ══════════════════════════════════════════════════════════════════════════
async function seedRemote() {
  console.log(`[Seed] ═══════════════════════════════════════════════`)
  console.log(`[Seed] Populating demo environment @ ${BASE_URL}`)
  console.log(`[Seed] ═══════════════════════════════════════════════`)

  // Re-runnable: every step below tolerates prior partial runs. Users that
  // already exist log in (registerOrLogin). Contests are matched by name via
  // GET /api/contests before POSTing. Joins that 409 are swallowed.

  // ── 1. Register users ────────────────────────────────────────────
  const admin  = await registerOrLogin('Admin',          'admin@beanstalk.app', DEMO_PASSWORD)
  const sarah  = await registerOrLogin('Sarah Chen',     'sarah@demo.com',      DEMO_PASSWORD)
  const marcus = await registerOrLogin('Marcus Johnson', 'marcus@demo.com',     DEMO_PASSWORD)
  const priya  = await registerOrLogin('Priya Patel',    'priya@demo.com',      DEMO_PASSWORD)
  const alex   = await registerOrLogin('Alex Rivera',    'alex@demo.com',       DEMO_PASSWORD)

  console.log('[Seed] 5 users created')
  for (const u of [admin, sarah, marcus, priya, alex]) {
    console.log(`[Seed]   ${u.name}`)
  }

  // ── 2. Create contests (as admin) ────────────────────────────────
  // Fetch existing contests once so repeat runs reuse them by name.
  const existingContests = (
    await httpRequest('GET', '/api/contests?limit=100', { token: admin.token })
  ).contests || []

  async function createContest(payload) {
    const existing = existingContests.find(c => c.name === payload.name)
    const contest = existing || await httpRequest('POST', '/api/contests', {
      token: admin.token,
      body: payload,
    })

    // The create endpoint doesn't accept `registration_deadline` — it defaults
    // to start_date, which rejects joins for contests whose start_date is in
    // the past (e.g. Winter Championship). Always push the deadline forward
    // via PUT so seed participants can join. Safe to call on existing
    // contests too; the service accepts registration_deadline on update.
    await httpRequest('PUT', `/api/contests/${contest.contest_id}`, {
      token: admin.token,
      body: { registration_deadline: daysFromNow(1) },
    })

    return contest
  }

  const fidelityCup = await createContest({
    name: 'Fidelity Spring Cup',
    description: 'A 30-day trading challenge sponsored by Fidelity. Build the best portfolio and compete for cash prizes!',
    start_date: daysAgo(15),
    end_date: daysFromNow(15),
    status: 'active',
    starting_balance: 10000,
    max_participants: 100,
    age_groups: ['high_school', 'college', 'adults'],
    rules: 'No penny stocks\nMax 25% in any single position\nStocks and ETFs only\nNo shorting allowed',
    sponsor_name: 'Fidelity',
    sponsor_logo_url: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://fidelity.com&size=128',
    sponsor_tagline: 'Invest wisely',
    prizes: [
      { rank_from: 1, rank_to: 1, prize_description: '$500 Cash Prize', prize_type: 'cash', prize_value: '500' },
      { rank_from: 2, rank_to: 2, prize_description: '$250 Cash Prize', prize_type: 'cash', prize_value: '250' },
      { rank_from: 3, rank_to: 3, prize_description: '$100 Cash Prize', prize_type: 'cash', prize_value: '100' },
    ],
  })

  const stepChallenge = await createContest({
    name: 'STEP Tech Challenge',
    description: 'Focus on tech stocks and prove your skills! Sponsored by STEP — banking for the next generation.',
    start_date: daysAgo(3),
    end_date: daysFromNow(11),
    status: 'active',
    starting_balance: 10000,
    max_participants: 50,
    age_groups: ['high_school', 'college', 'adults'],
    rules: 'Tech stocks only (Technology sector)\nMax 5 positions\nNo margin trading',
    sponsor_name: 'STEP',
    sponsor_logo_url: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://step.com&size=128',
    sponsor_tagline: 'Banking for the next generation',
    prizes: [
      { rank_from: 1, rank_to: 1, prize_description: '$250 Cash Prize', prize_type: 'cash', prize_value: '250' },
      { rank_from: 2, rank_to: 2, prize_description: '$100 Cash Prize', prize_type: 'cash', prize_value: '100' },
    ],
  })

  const rookieCup = await createContest({
    name: 'Spring Rookie Cup',
    description: 'Perfect for beginners! Start with $10K in virtual cash and learn the ropes of trading.',
    start_date: daysFromNow(5),
    end_date: daysFromNow(26),
    status: 'draft',
    starting_balance: 10000,
    max_participants: 200,
    age_groups: ['high_school', 'college', 'adults'],
    rules: 'All stocks and ETFs allowed\nMax 10 positions\nGreat for first-time traders!',
    prizes: [
      { rank_from: 1, rank_to: 1, prize_description: '$100 Cash Prize', prize_type: 'cash', prize_value: '100' },
      { rank_from: 2, rank_to: 2, prize_description: '$50 Cash Prize', prize_type: 'cash', prize_value: '50' },
    ],
  })

  const winterChamp = await createContest({
    name: 'Winter Trading Championship',
    description: 'The big one! 30-day championship with Fidelity sponsorship and serious prizes.',
    start_date: daysAgo(37),
    end_date: daysAgo(7),
    status: 'active', // concluded at the end after joining + trading
    starting_balance: 10000,
    max_participants: 100,
    age_groups: ['college', 'adults'],
    rules: 'All strategies allowed\nShorting permitted\nNo restrictions',
    sponsor_name: 'Fidelity',
    sponsor_logo_url: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://fidelity.com&size=128',
    sponsor_tagline: 'Invest wisely',
    prizes: [
      { rank_from: 1, rank_to: 1, prize_description: '$500 Grand Prize', prize_type: 'cash', prize_value: '500' },
      { rank_from: 2, rank_to: 2, prize_description: '$250 Runner-up', prize_type: 'cash', prize_value: '250' },
      { rank_from: 3, rank_to: 3, prize_description: '$100 Third Place', prize_type: 'cash', prize_value: '100' },
    ],
  })

  // Contest creates return a bare ID payload; keep under the same var names.
  console.log('[Seed] 4 contests created')

  // ── 3. Join + trade + update prices ──────────────────────────────
  async function seedPlayer(contest, user, ageGroup, trades, priceMap) {
    let portfolioId

    // Join contest — response has portfolio_id for this participation. If the
    // user already joined (409/400 with "already joined"), fetch the existing
    // contest portfolio instead.
    try {
      const join = await httpRequest('POST', `/api/contests/${contest.contest_id}/join`, {
        token: user.token,
        body: { user_id: user.user_id, age_group: ageGroup },
      })
      portfolioId = join.portfolio_id
    } catch (err) {
      if (err.status === 400 && /already joined/i.test(err.body?.error || '')) {
        const p = await httpRequest('GET',
          `/api/portfolio/${user.user_id}?contest_id=${contest.contest_id}`,
          { token: user.token })
        portfolioId = p.portfolio_id
        return portfolioId // positions from prior run; skip re-trading
      }
      throw err
    }

    // Execute buy trades at historical prices (demo mode honors client price)
    for (const [symbol, quantity, price] of trades) {
      await httpRequest('POST', `/api/portfolio/${user.user_id}/trade`, {
        token: user.token,
        body: {
          action: 'buy',
          symbol,
          quantity,
          price, // demo mode uses client-supplied price as fill price
          portfolio_id: portfolioId,
        },
      })
    }

    // Update portfolio prices to current market to generate gain/loss
    await httpRequest('PUT', `/api/portfolio/${portfolioId}/update-prices`, {
      token: user.token,
      body: { priceMap },
    })

    return portfolioId
  }

  // ── Fidelity Spring Cup: all 4 users ─────────────────────────────
  await seedPlayer(fidelityCup, sarah, 'college', [
    ['AAPL', 5, 180],
    ['MSFT', 3, 390],
    ['NVDA', 2, 460],
  ], marketPrices)

  await seedPlayer(fidelityCup, marcus, 'adults', [
    ['TSLA', 4, 350],
    ['GOOGL', 2, 165],
    ['META', 3, 620],
  ], marketPrices)

  await seedPlayer(fidelityCup, alex, 'adults', [
    ['AMZN', 3, 205],
    ['COIN', 5, 240],
  ], marketPrices)

  await seedPlayer(fidelityCup, priya, 'high_school', [
    ['AMD', 8, 180],
    ['PLTR', 20, 30],
  ], marketPrices)

  console.log('[Seed] Fidelity Spring Cup: 4 players with portfolios')

  // ── STEP Tech Challenge: 3 users ─────────────────────────────────
  await seedPlayer(stepChallenge, marcus, 'adults', [
    ['NVDA', 4, 440],
    ['META', 2, 630],
  ], marketPrices)

  await seedPlayer(stepChallenge, priya, 'high_school', [
    ['MSFT', 5, 392],
    ['AAPL', 8, 190],
  ], marketPrices)

  await seedPlayer(stepChallenge, sarah, 'college', [
    ['GOOGL', 10, 180],
    ['MSFT', 3, 415],
  ], marketPrices)

  console.log('[Seed] STEP Tech Challenge: 3 players with portfolios')

  // ── Winter Championship: 3 users, then conclude ──────────────────
  await seedPlayer(winterChamp, marcus, 'adults', [
    ['NVDA', 5, 380],
    ['META', 4, 480],
    ['TSLA', 3, 310],
  ], { NVDA: 510, META: 673, TSLA: 387 })

  await seedPlayer(winterChamp, sarah, 'college', [
    ['AAPL', 10, 170],
    ['MSFT', 5, 360],
    ['SPY', 3, 480],
  ], { AAPL: 204, MSFT: 418, SPY: 535 })

  await seedPlayer(winterChamp, alex, 'adults', [
    ['GOOGL', 12, 165],
    ['AMZN', 5, 180],
  ], { GOOGL: 178, AMZN: 198 })

  try {
    await httpRequest('POST', `/api/contests/${winterChamp.contest_id}/conclude`, {
      token: admin.token,
    })
    console.log('[Seed] Winter Championship: 3 players, concluded with winners')
  } catch (err) {
    if (err.status === 400 && /already concluded/i.test(err.body?.error || '')) {
      console.log('[Seed] Winter Championship: already concluded')
    } else throw err
  }

  // ── 4. Sarah's personal portfolio ────────────────────────────────
  // Main portfolio lazy-creates on first access; hit it first to create it
  // (or fetch it on a re-run) and only seed trades if it's still empty.
  const mainPortfolio = await httpRequest('GET', `/api/portfolio/${sarah.user_id}`, {
    token: sarah.token,
  })

  if (!mainPortfolio.positions || mainPortfolio.positions.length === 0) {
    for (const [symbol, quantity, price] of [
      ['AAPL', 8, 192],
      ['NVDA', 3, 478],
      ['TSLA', 4, 245],
      ['SPY',  2, 520],
    ]) {
      await httpRequest('POST', `/api/portfolio/${sarah.user_id}/trade`, {
        token: sarah.token,
        body: { action: 'buy', symbol, quantity, price },
      })
    }

    await httpRequest('PUT', `/api/portfolio/${mainPortfolio.portfolio_id}/update-prices`, {
      token: sarah.token,
      body: { priceMap: marketPrices },
    })
    console.log('[Seed] Sarah\'s personal portfolio seeded (AAPL, NVDA, TSLA, SPY)')
  } else {
    console.log('[Seed] Sarah\'s personal portfolio: already populated')
  }

  printSummary()
}

// ══════════════════════════════════════════════════════════════════════════
// LOCAL SEED (in-process, uses _memory_store directly)
// ══════════════════════════════════════════════════════════════════════════
async function seedLocal() {
  const bcrypt = require('bcryptjs')
  const store = require('../src/services/_memory_store')
  const HASH = bcrypt.hashSync(DEMO_PASSWORD, 10)

  if (store.users.getUserByEmail('sarah@demo.com')) {
    console.log('[Seed] Demo data already exists — skipping.')
    return
  }

  console.log('[Seed] ═══════════════════════════════════════════════')
  console.log('[Seed] Populating Beanstalk demo environment (local)...')
  console.log('[Seed] ═══════════════════════════════════════════════')

  const admin  = store.users.createUser('Admin',          'admin@beanstalk.app', HASH)
  const sarah  = store.users.createUser('Sarah Chen',     'sarah@demo.com',      HASH)
  const marcus = store.users.createUser('Marcus Johnson',  'marcus@demo.com',     HASH)
  const priya  = store.users.createUser('Priya Patel',     'priya@demo.com',      HASH)
  const alex   = store.users.createUser('Alex Rivera',     'alex@demo.com',       HASH)

  console.log('[Seed] 5 users created')

  const fidelityCup = await store.contest.createContest(admin.user_id, {
    name: 'Fidelity Spring Cup',
    description: 'A 30-day trading challenge sponsored by Fidelity. Build the best portfolio and compete for cash prizes!',
    start_date: daysAgo(15),
    end_date: daysFromNow(15),
    status: 'active',
    starting_balance: 10000,
    max_participants: 100,
    min_participants: 2,
    age_groups: ['high_school', 'college', 'adults'],
    contest_difficulty_level: 'intermediate',
    rules: 'No penny stocks\nMax 25% in any single position\nStocks and ETFs only\nNo shorting allowed',
    sponsor_name: 'Fidelity',
    sponsor_logo_url: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://fidelity.com&size=128',
    sponsor_tagline: 'Invest wisely',
    prizes: [
      { rank_from: 1, rank_to: 1, prize_description: '$500 Cash Prize', prize_type: 'cash', prize_value: '500' },
      { rank_from: 2, rank_to: 2, prize_description: '$250 Cash Prize', prize_type: 'cash', prize_value: '250' },
      { rank_from: 3, rank_to: 3, prize_description: '$100 Cash Prize', prize_type: 'cash', prize_value: '100' },
    ],
  })

  const stepChallenge = await store.contest.createContest(admin.user_id, {
    name: 'STEP Tech Challenge',
    description: 'Focus on tech stocks and prove your skills! Sponsored by STEP — banking for the next generation.',
    start_date: daysAgo(3),
    end_date: daysFromNow(11),
    status: 'active',
    starting_balance: 10000,
    max_participants: 50,
    min_participants: 2,
    age_groups: ['high_school', 'college', 'adults'],
    contest_difficulty_level: 'beginner',
    rules: 'Tech stocks only (Technology sector)\nMax 5 positions\nNo margin trading',
    sponsor_name: 'STEP',
    sponsor_logo_url: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://step.com&size=128',
    sponsor_tagline: 'Banking for the next generation',
    prizes: [
      { rank_from: 1, rank_to: 1, prize_description: '$250 Cash Prize', prize_type: 'cash', prize_value: '250' },
      { rank_from: 2, rank_to: 2, prize_description: '$100 Cash Prize', prize_type: 'cash', prize_value: '100' },
    ],
  })

  await store.contest.createContest(admin.user_id, {
    name: 'Spring Rookie Cup',
    description: 'Perfect for beginners! Start with $10K in virtual cash and learn the ropes of trading.',
    start_date: daysFromNow(5),
    end_date: daysFromNow(26),
    status: 'draft',
    starting_balance: 10000,
    max_participants: 200,
    min_participants: 5,
    age_groups: ['high_school', 'college', 'adults'],
    contest_difficulty_level: 'beginner',
    rules: 'All stocks and ETFs allowed\nMax 10 positions\nGreat for first-time traders!',
    prizes: [
      { rank_from: 1, rank_to: 1, prize_description: '$100 Cash Prize', prize_type: 'cash', prize_value: '100' },
      { rank_from: 2, rank_to: 2, prize_description: '$50 Cash Prize', prize_type: 'cash', prize_value: '50' },
    ],
  })

  const winterChamp = await store.contest.createContest(admin.user_id, {
    name: 'Winter Trading Championship',
    description: 'The big one! 30-day championship with Fidelity sponsorship and serious prizes.',
    start_date: daysAgo(37),
    end_date: daysAgo(7),
    registration_deadline: daysFromNow(1),
    status: 'active',
    starting_balance: 10000,
    max_participants: 100,
    min_participants: 2,
    age_groups: ['college', 'adults'],
    contest_difficulty_level: 'advanced',
    rules: 'All strategies allowed\nShorting permitted\nNo restrictions',
    sponsor_name: 'Fidelity',
    sponsor_logo_url: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://fidelity.com&size=128',
    sponsor_tagline: 'Invest wisely',
    prizes: [
      { rank_from: 1, rank_to: 1, prize_description: '$500 Grand Prize', prize_type: 'cash', prize_value: '500' },
      { rank_from: 2, rank_to: 2, prize_description: '$250 Runner-up', prize_type: 'cash', prize_value: '250' },
      { rank_from: 3, rank_to: 3, prize_description: '$100 Third Place', prize_type: 'cash', prize_value: '100' },
    ],
  })

  console.log('[Seed] 4 contests created')

  async function seedPlayer(contestId, userId, ageGroup, trades, priceMap) {
    const part = await store.contest.joinContest(contestId, userId, ageGroup)
    for (const [sym, qty, price] of trades) {
      await store.portfolio.executeBuyTrade(part.portfolio_snapshot_id, sym, qty, price)
    }
    await store.portfolio.updatePortfolioPrices(part.portfolio_snapshot_id, priceMap)
    return part
  }

  await seedPlayer(fidelityCup.contest_id, sarah.user_id, 'college', [
    ['AAPL', 5, 180], ['MSFT', 3, 390], ['NVDA', 2, 460],
  ], marketPrices)
  await seedPlayer(fidelityCup.contest_id, marcus.user_id, 'adults', [
    ['TSLA', 4, 350], ['GOOGL', 2, 165], ['META', 3, 620],
  ], marketPrices)
  await seedPlayer(fidelityCup.contest_id, alex.user_id, 'adults', [
    ['AMZN', 3, 205], ['COIN', 5, 240],
  ], marketPrices)
  await seedPlayer(fidelityCup.contest_id, priya.user_id, 'high_school', [
    ['AMD', 8, 180], ['PLTR', 20, 30],
  ], marketPrices)
  console.log('[Seed] Fidelity Spring Cup: 4 players with portfolios')

  await seedPlayer(stepChallenge.contest_id, marcus.user_id, 'adults', [
    ['NVDA', 4, 440], ['META', 2, 630],
  ], marketPrices)
  await seedPlayer(stepChallenge.contest_id, priya.user_id, 'high_school', [
    ['MSFT', 5, 392], ['AAPL', 8, 190],
  ], marketPrices)
  await seedPlayer(stepChallenge.contest_id, sarah.user_id, 'college', [
    ['GOOGL', 10, 180], ['MSFT', 3, 415],
  ], marketPrices)
  console.log('[Seed] STEP Tech Challenge: 3 players with portfolios')

  await seedPlayer(winterChamp.contest_id, marcus.user_id, 'adults', [
    ['NVDA', 5, 380], ['META', 4, 480], ['TSLA', 3, 310],
  ], { NVDA: 510, META: 673, TSLA: 387 })
  await seedPlayer(winterChamp.contest_id, sarah.user_id, 'college', [
    ['AAPL', 10, 170], ['MSFT', 5, 360], ['SPY', 3, 480],
  ], { AAPL: 204, MSFT: 418, SPY: 535 })
  await seedPlayer(winterChamp.contest_id, alex.user_id, 'adults', [
    ['GOOGL', 12, 165], ['AMZN', 5, 180],
  ], { GOOGL: 178, AMZN: 198 })
  await store.contest.concludeContest(winterChamp.contest_id)
  console.log('[Seed] Winter Championship: 3 players, concluded with winners')

  const mainPortfolio = await store.portfolio.createPortfolio(sarah.user_id, 10000, 'main')
  await store.portfolio.executeBuyTrade(mainPortfolio.portfolio_id, 'AAPL', 8, 192)
  await store.portfolio.executeBuyTrade(mainPortfolio.portfolio_id, 'NVDA', 3, 478)
  await store.portfolio.executeBuyTrade(mainPortfolio.portfolio_id, 'TSLA', 4, 245)
  await store.portfolio.executeBuyTrade(mainPortfolio.portfolio_id, 'SPY', 2, 520)
  await store.portfolio.updatePortfolioPrices(mainPortfolio.portfolio_id, marketPrices)
  console.log('[Seed] Sarah\'s personal portfolio seeded (AAPL, NVDA, TSLA, SPY)')

  printSummary()
}

function printSummary() {
  console.log('')
  console.log('[Seed] ═══════════════════════════════════════════════')
  console.log('[Seed]  Demo environment ready!')
  console.log('[Seed] ═══════════════════════════════════════════════')
  console.log('[Seed]  Users:    5 (admin + 4 demo)')
  console.log('[Seed]  Contests: 4')
  console.log('[Seed]    1. Fidelity Spring Cup   — ACTIVE, 4 players, $850 prizes')
  console.log('[Seed]    2. STEP Tech Challenge    — ACTIVE, 3 players, $350 prizes')
  console.log('[Seed]    3. Spring Rookie Cup      — UPCOMING, registrations open')
  console.log('[Seed]    4. Winter Championship    — CONCLUDED, winners announced')
  console.log('[Seed]  Personal portfolio: Sarah has AAPL, NVDA, TSLA, SPY')
  console.log('[Seed] ───────────────────────────────────────────────')
  console.log('[Seed]  Login credentials (all use Demo123!):')
  console.log('[Seed]    admin@beanstalk.app   (admin)')
  console.log('[Seed]    sarah@demo.com        (college)')
  console.log('[Seed]    marcus@demo.com       (adults)')
  console.log('[Seed]    priya@demo.com        (high school)')
  console.log('[Seed]    alex@demo.com         (adults)')
  console.log('[Seed] ═══════════════════════════════════════════════')
}

// ── Entrypoint ────────────────────────────────────────────────────────────
// CLI (npm run seed:demo): BASE_URL defaults to http://localhost:8080 and the
// script talks to a running API over HTTP. Set BASE_URL explicitly to target
// a deployed environment (e.g. https://beanstalk-api.fly.dev).
//
// Server boot (BEANSTALK_ENVIRONMENT=demo requires this module): BASE_URL is
// unset by default, so seedLocal() populates the in-process _memory_store
// directly — this is the only mode that can share state with the same process.
async function seed() {
  if (BASE_URL) {
    await seedRemote()
  } else {
    await seedLocal()
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(err => { console.error('[Seed] FAILED:', err); process.exit(1) })
} else {
  module.exports = seed
}
