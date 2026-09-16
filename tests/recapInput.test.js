/**
 * Recap INPUT builder tests (pure code, no AI).
 *
 * The core `buildRecapInput` is exercised with plain synthetic data — no
 * services, no market data. A light orchestrator test drives
 * `assembleRecapInput` through the in-memory store (join a contest, trade,
 * then assemble) with injected stub deps so it runs credential-free.
 */

process.env.BEANSTALK_ENVIRONMENT = 'test'

const {
  buildRecapInput,
  assembleRecapInput,
  _internals,
} = require('../src/services/recapInput.service')

// ---- fixtures -------------------------------------------------------------

const START = new Date('2026-01-01T00:00:00Z')
const END = new Date('2026-03-02T00:00:00Z') // ~60 days later

const contest = {
  name: 'Spring Sprint',
  start_date: START,
  end_date: END,
  starting_balance: 10000,
  current_participants: 3,
}

// Ghost benchmark curves (as computeGhostRankings would return them).
const benchmarks = [
  {
    user_id: 'ghost:spx', username: 'Sammy P.', benchmark: 'S&P 500', benchmark_symbol: 'SPY',
    return_percent: 6.2, portfolio_value: 10620, is_ghost: true,
  },
  {
    user_id: 'ghost:ndx', username: 'Nadia Q.', benchmark: 'NASDAQ-100', benchmark_symbol: 'QQQ',
    return_percent: 9.4, portfolio_value: 10940, is_ghost: true,
  },
  {
    user_id: 'ghost:cash', username: 'Piggy', benchmark: 'Savings', benchmark_symbol: null,
    return_percent: 0.7, portfolio_value: 10070, is_ghost: true,
  },
]

function pos(symbol, glpPercent, extra = {}) {
  return {
    position_id: `pos-${symbol}-${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    quantity: 1,
    purchase_price: 100,
    current_price: 100 * (1 + glpPercent / 100),
    current_value: 100 * (1 + glpPercent / 100),
    unrealized_gain_loss: glpPercent,
    unrealized_gain_loss_percent: glpPercent,
    updated_at: END,
    ...extra,
  }
}

function player(user_id, username, returnPercent, value, positions) {
  return {
    user_id,
    username,
    portfolio_snapshot: {
      portfolio_id: `pf-${user_id}`,
      total_portfolio_value: value,
      total_return_percent: returnPercent,
      position_count: positions.length,
      positions,
    },
  }
}

// Ada beats the market; Ben beats savings but not the market; Cara loses.
const participants = [
  player('user-ada', 'Ada Lovelace', 12.0, 11200, [
    pos('NVDA', 24.0, { asset_class: 'stocks', purchase_date: START }),
    pos('AAPL', 3.0, { asset_class: 'stocks', purchase_date: START }),
  ]),
  player('user-ben', 'Ben Franklin', 2.5, 10250, [
    pos('AAPL', 4.0, { asset_class: 'stocks', purchase_date: START }),
    pos('VOO', 1.5, { asset_class: 'etfs', purchase_date: START }),
  ]),
  player('user-cara', 'Cara Diaz', -8.0, 9200, [
    pos('GME', -32.0, { asset_class: 'stocks', purchase_date: START }),
    pos('AAPL', -1.0, { asset_class: 'stocks', purchase_date: START }),
  ]),
]

// ---- contest block --------------------------------------------------------

describe('buildRecapInput — contest block', () => {
  test('name, dates, day span, starting balance, player count', () => {
    const { contest: c } = buildRecapInput({ contest, participants, benchmarks })
    expect(c.name).toBe('Spring Sprint')
    expect(c.days).toBe(60)
    expect(c.start).toBe(START.toISOString())
    expect(c.end).toBe(END.toISOString())
    expect(c.starting_balance).toBe(10000)
    expect(c.player_count).toBe(3)
  })

  test('throws without a contest', () => {
    expect(() => buildRecapInput({ participants, benchmarks })).toThrow(/contest is required/)
  })
})

// ---- market context -------------------------------------------------------

describe('buildRecapInput — market_context', () => {
  test('lists benchmarks, picks best market index (not savings), reports savings', () => {
    const { market_context: m } = buildRecapInput({ contest, participants, benchmarks })
    expect(m.benchmarks).toEqual([
      { name: 'Sammy P.', label: 'S&P 500', return_percent: 6.2 },
      { name: 'Nadia Q.', label: 'NASDAQ-100', return_percent: 9.4 },
      { name: 'Piggy', label: 'Savings', return_percent: 0.7 },
    ])
    // Nadia Q. (+9.4) is the best *index*; Piggy is excluded from best_benchmark.
    expect(m.best_benchmark).toBe('Nadia Q.')
    expect(m.savings_return_percent).toBe(0.7)
  })

  test('degrades gracefully with no benchmarks', () => {
    const { market_context: m, field } = buildRecapInput({ contest, participants, benchmarks: [] })
    expect(m.benchmarks).toEqual([])
    expect(m.best_benchmark).toBeNull()
    expect(m.savings_return_percent).toBeNull()
    expect(field.share_that_beat_sammy_p).toBeNull()
    expect(field.share_that_beat_piggy).toBeNull()
  })
})

// ---- field (aggregate, anonymous) -----------------------------------------

describe('buildRecapInput — field', () => {
  test('median and the active-vs-passive shares', () => {
    const { field } = buildRecapInput({ contest, participants, benchmarks })
    // returns 12.0, 2.5, -8.0 → median 2.5
    expect(field.median_return_percent).toBe(2.5)
    // beat Sammy P. (6.2): only Ada (12) → 1/3
    expect(field.share_that_beat_sammy_p).toBeCloseTo(1 / 3, 4)
    // beat Piggy (0.7): Ada + Ben → 2/3
    expect(field.share_that_beat_piggy).toBeCloseTo(2 / 3, 4)
  })
})

// ---- highlights -----------------------------------------------------------

describe('buildRecapInput — highlights', () => {
  test('best_trade is the top gainer, named, with held days', () => {
    const { highlights } = buildRecapInput({ contest, participants, benchmarks })
    expect(highlights.best_trade.symbol).toBe('NVDA') // +24%
    expect(highlights.best_trade.return_percent).toBe(24)
    expect(highlights.best_trade.player).toBe('Ada Lovelace')
    expect(highlights.best_trade.held_days).toBe(60)
  })

  test('biggest_swing is the largest absolute mover and stays anonymous', () => {
    const { highlights } = buildRecapInput({ contest, participants, benchmarks })
    expect(highlights.biggest_swing.symbol).toBe('GME') // -32% is the biggest magnitude
    expect(highlights.biggest_swing.swing_percent).toBe(-32)
    expect(highlights.biggest_swing).not.toHaveProperty('player')
  })

  test('top_sectors average return by asset_class, best first', () => {
    const { highlights } = buildRecapInput({ contest, participants, benchmarks })
    // etfs: VOO 1.5 → 1.5 ; stocks: 24,3,4,-32,-1 → avg -0.4
    const sectors = highlights.top_sectors
    expect(sectors[0]).toEqual({ sector: 'etfs', avg_return_percent: 1.5 })
    expect(sectors.find(s => s.sector === 'stocks').avg_return_percent).toBeCloseTo(-0.4, 6)
  })

  test('most_popular_symbols ranks by distinct holders', () => {
    const { highlights } = buildRecapInput({ contest, participants, benchmarks })
    // AAPL held by all 3 → first.
    expect(highlights.most_popular_symbols[0]).toBe('AAPL')
    expect(highlights.most_popular_symbols).toEqual(
      expect.arrayContaining(['AAPL', 'NVDA', 'VOO', 'GME']),
    )
  })

  test('positions with no asset_class yield an empty sector list (BQ store case)', () => {
    const untagged = [
      player('u1', 'One', 5, 10500, [pos('AAPL', 5)]), // no asset_class
    ]
    const { highlights } = buildRecapInput({ contest, participants: untagged, benchmarks })
    expect(highlights.top_sectors).toEqual([])
    expect(highlights.best_trade.held_days).toBeNull() // no purchase_date
  })
})

// ---- winner ---------------------------------------------------------------

describe('buildRecapInput — winner', () => {
  test('rank #1 by portfolio value, named, beat_sammy_p flag', () => {
    const { winner } = buildRecapInput({ contest, participants, benchmarks })
    expect(winner.player).toBe('Ada Lovelace')
    expect(winner.return_percent).toBe(12)
    expect(winner.beat_sammy_p).toBe(true)
  })

  test('beat_sammy_p is null when Sammy P. is absent', () => {
    const noSpx = benchmarks.filter(b => b.user_id !== 'ghost:spx')
    const { winner } = buildRecapInput({ contest, participants, benchmarks: noSpx })
    expect(winner.beat_sammy_p).toBeNull()
  })
})

// ---- privacy / anonymization ----------------------------------------------

describe('buildRecapInput — named callouts vs anonymity', () => {
  test('a UUID-shaped username is never exposed as a name', () => {
    const anon = [
      player('11111111-2222-3333-4444-555555555555',
        '11111111-2222-3333-4444-555555555555', 15, 11500, [
          pos('TSLA', 40, { asset_class: 'stocks', purchase_date: START }),
        ]),
    ]
    const { winner, highlights } = buildRecapInput({ contest, participants: anon, benchmarks })
    expect(winner.player).toBeNull() // anonymized, not the raw id
    expect(highlights.best_trade.player).toBeNull()
  })
})

// ---- personal mini-recap --------------------------------------------------

describe('buildRecapInput — personal', () => {
  test('omitted unless a personalUserId is given and found', () => {
    expect(buildRecapInput({ contest, participants, benchmarks })).not.toHaveProperty('personal')
    expect(buildRecapInput({ contest, participants, benchmarks, personalUserId: 'nobody' }))
      .not.toHaveProperty('personal')
  })

  test('winner personal recap: beat market + savings, best pick, upbeat hook', () => {
    const { personal } = buildRecapInput({
      contest, participants, benchmarks, personalUserId: 'user-ada',
    })
    expect(personal.return_percent).toBe(12)
    expect(personal.beat_sammy_p).toBe(true)
    expect(personal.beat_piggy).toBe(true)
    expect(personal.best_trade).toEqual({ symbol: 'NVDA', return_percent: 24 })
    expect(personal.lessons_hook).toMatch(/beat the market/i)
  })

  test('a losing player still gets an encouraging, non-shaming hook', () => {
    const { personal } = buildRecapInput({
      contest, participants, benchmarks, personalUserId: 'user-cara',
    })
    expect(personal.beat_sammy_p).toBe(false)
    expect(personal.beat_piggy).toBe(false)
    expect(personal.lessons_hook).toMatch(/tricky round/i)
    // never shames, never names a loss
    expect(personal.lessons_hook).not.toMatch(/lost|mistake|bad/i)
  })
})

// ---- empty / edge ---------------------------------------------------------

describe('buildRecapInput — empty field', () => {
  test('no participants → valid, sparse payload', () => {
    const input = buildRecapInput({ contest, participants: [], benchmarks })
    expect(input.contest.player_count).toBe(0)
    expect(input.field.median_return_percent).toBeNull()
    expect(input.field.share_that_beat_sammy_p).toBeNull()
    expect(input.highlights.best_trade).toBeNull()
    expect(input.highlights.biggest_swing).toBeNull()
    expect(input.highlights.top_sectors).toEqual([])
    expect(input.highlights.most_popular_symbols).toEqual([])
    expect(input.winner).toBeNull()
  })

  test('participants without a portfolio snapshot are excluded from stats', () => {
    const mixed = [
      ...participants,
      { user_id: 'user-dora', username: 'Dora', portfolio_snapshot: null },
    ]
    const input = buildRecapInput({ contest, participants: mixed, benchmarks })
    expect(input.contest.player_count).toBe(4) // enrolled
    expect(input.field.median_return_percent).toBe(2.5) // stats unchanged (Dora excluded)
  })
})

// ---- internals ------------------------------------------------------------

describe('recapInput internals', () => {
  test('median: odd and even lengths', () => {
    expect(_internals.median([3, 1, 2])).toBe(2)
    expect(_internals.median([4, 1, 2, 3])).toBe(2.5)
    expect(_internals.median([])).toBeNull()
  })

  test('shareAbove: strictly greater, null when empty', () => {
    expect(_internals.shareAbove([1, 2, 3], 2)).toBeCloseTo(1 / 3, 6)
    expect(_internals.shareAbove([], 2)).toBeNull()
  })

  test('friendlyName: real name kept, uuid anonymized', () => {
    expect(_internals.friendlyName({ username: 'Ada' })).toBe('Ada')
    expect(_internals.friendlyName({ username: '11111111-2222-3333-4444-555555555555' })).toBeNull()
    expect(_internals.friendlyName({ username: '' })).toBeNull()
  })
})

// ---- orchestrator through the in-memory store -----------------------------

describe('assembleRecapInput — orchestration (in-memory store)', () => {
  const memory = require('../src/services/_memory_store')
  const contestService = memory.contest

  // Deterministic benchmark stub: Sammy P. flat +5%, Piggy handled by the real
  // savings curve — but we inject a fixed roster to keep the test independent
  // of dates/market data.
  const benchmarkService = {
    computeGhostRankings: async () => [
      { user_id: 'ghost:spx', username: 'Sammy P.', benchmark: 'S&P 500', benchmark_symbol: 'SPY', return_percent: 5 },
      { user_id: 'ghost:cash', username: 'Piggy', benchmark: 'Savings', benchmark_symbol: null, return_percent: 1 },
    ],
  }

  test('assembles a valid INPUT from a real contest + a joined, trading player', async () => {
    const created = await contestService.createContest('admin-recap', {
      name: 'Store Recap Test',
      age_groups: ['high_school'],
      start_date: new Date(Date.now() - 30 * 86400000),
      end_date: new Date(Date.now() + 1 * 86400000), // registration still open so the join works
      starting_balance: 10000,
      status: 'active',
    })
    const contestId = created.contest_id || created.id

    // A player joins and buys something so there's a position to summarize.
    const participation = await contestService.joinContest(contestId, 'recap-user-1', 'high_school')
    const pfId = participation.portfolio_snapshot_id
    await memory.portfolio.executeBuyTrade(pfId, 'AAPL', 5, 100)
    await memory.portfolio.updatePortfolioPrices(pfId, { AAPL: 120 }) // +20%

    const input = await assembleRecapInput(contestId, {
      deps: { contestService, benchmarkService },
    })

    expect(input.contest.name).toBe('Store Recap Test')
    expect(input.contest.player_count).toBe(1)
    expect(input.market_context.benchmarks.map(b => b.name)).toEqual(['Sammy P.', 'Piggy'])
    expect(input.highlights.best_trade.symbol).toBe('AAPL')
    expect(input.highlights.best_trade.return_percent).toBeCloseTo(20, 4)
    // in-memory positions carry asset_class → a sector shows up
    expect(input.highlights.top_sectors.length).toBeGreaterThan(0)
    expect(input.winner).not.toBeNull()
  })

  test('throws for an unknown contest id', async () => {
    await expect(
      assembleRecapInput('does-not-exist', { deps: { contestService, benchmarkService } }),
    ).rejects.toThrow(/Contest not found/)
  })
})
