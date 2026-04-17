/**
 * Portfolio Controller
 * Handles portfolio API requests
 */

const portfolioService = require('../services/portfolio.service')
const alpacaService = require('../services/alpaca.service')

/**
 * Resolve the portfolio a trade/query should operate on.
 *
 * Precedence (first non-null wins):
 *   1. explicit portfolio_id — must belong to this user
 *   2. contest_id            — must be a contest the user has joined
 *   3. default                — the user's main portfolio (lazy-created if missing)
 *
 * Returns `{ portfolio, error }`. `error` is a {status, message} object when the
 * caller should bail; otherwise `portfolio` is the resolved portfolio object.
 */
async function resolveUserPortfolio(userId, { portfolio_id, contest_id } = {}) {
  if (portfolio_id) {
    const p = await portfolioService.getPortfolio(portfolio_id)
    if (!p) return { error: { status: 404, message: 'Portfolio not found' } }
    if (p.user_id !== userId) {
      return { error: { status: 403, message: 'Portfolio does not belong to this user' } }
    }
    return { portfolio: p }
  }

  if (contest_id) {
    const p = await portfolioService.getUserContestPortfolio(userId, contest_id)
    if (!p) {
      return {
        error: {
          status: 404,
          message: 'No contest portfolio found for this user. Join the contest first.',
        },
      }
    }
    return { portfolio: p }
  }

  let main = await portfolioService.getUserMainPortfolio(userId)
  if (!main) {
    // Lazy-create main on first access; createPortfolio is idempotent per the
    // uniqueness guard, so concurrent calls won't duplicate.
    main = await portfolioService.createPortfolio(userId, 10000, 'main')
  }
  return { portfolio: main }
}

/**
 * GET /api/portfolio/:userId
 * Get user's main portfolio
 */
/**
 * GET /api/portfolio/:userId
 * GET /api/portfolio/:userId?contest_id=<id>
 *
 * Without contest_id: returns the user's main portfolio. Lazy-creates a
 * $10,000 main portfolio on first access.
 *
 * With contest_id: returns the user's portfolio for that specific contest.
 * 404s if the user has not joined the contest (no lazy-create here — a
 * contest portfolio must be seeded via POST /api/contests/:id/join so that
 * the participant row is also written).
 */
async function getPortfolio(req, res) {
  try {
    const { userId } = req.params
    const { contest_id: contestId } = req.query

    if (req.user.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    let portfolio

    if (contestId) {
      portfolio = await portfolioService.getUserContestPortfolio(userId, contestId)
      if (!portfolio) {
        return res.status(404).json({
          error: 'No contest portfolio found for this user. Join the contest first.',
        })
      }
    } else {
      portfolio = await portfolioService.getUserMainPortfolio(userId)
      if (!portfolio) {
        // Lazy-create main portfolio on first access. createPortfolio is
        // idempotent (see uniqueness guard in portfolio.service.js), so
        // concurrent first-fetches won't duplicate.
        portfolio = await portfolioService.createPortfolio(userId, 10000, 'main')
      }
    }

    // Performance metrics come from the same source as the portfolio; for a
    // freshly-created main portfolio they're all zeros, which is fine.
    const metrics = await portfolioService.calculatePerformanceMetrics(portfolio.portfolio_id)

    res.json({
      portfolio_id: portfolio.portfolio_id,
      user_id: portfolio.user_id,
      portfolio_type: portfolio.portfolio_type,
      contest_id: portfolio.contest_id || null,
      starting_balance: portfolio.starting_balance,
      current_balance: portfolio.current_cash_balance,
      invested_value: portfolio.total_position_value,
      total_value: portfolio.total_portfolio_value,
      total_return_percent: portfolio.total_return_percent,
      total_return_amount: portfolio.total_return_amount,
      positions: portfolio.positions,
      metrics,
      updated_at: portfolio.updated_at,
    })
  } catch (error) {
    console.error('Portfolio fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch portfolio' })
  }
}

/**
 * POST /api/portfolio/:userId/trade
 * Execute buy or sell trade.
 *
 * Body:
 *   action:       'buy' | 'sell'       (required)
 *   symbol:       string                (required)
 *   quantity:     number                (required, > 0)
 *   portfolio_id: string                (optional — target a specific portfolio)
 *   contest_id:   string                (optional — target the user's portfolio for this contest)
 *
 * If neither portfolio_id nor contest_id is supplied, the trade runs against
 * the user's main portfolio (lazy-created at $10,000 if missing).
 */
async function executeTrade(req, res) {
  try {
    const { userId } = req.params
    const { action, symbol, quantity, portfolio_id, contest_id, price: clientPrice } = req.body

    if (req.user.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Validate input
    if (!['buy', 'sell'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "buy" or "sell"' })
    }

    if (!symbol || !quantity) {
      return res.status(400).json({ error: 'Missing required fields: symbol, quantity' })
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be positive' })
    }

    // Resolve target portfolio (main by default, or scoped to contest/portfolio_id)
    const { portfolio, error } = await resolveUserPortfolio(userId, { portfolio_id, contest_id })
    if (error) {
      return res.status(error.status).json({ error: error.message })
    }

    // In test/dev mode the mobile app is the source of truth for prices:
    // it displays mock prices from a static catalog and has no Alpaca
    // plumbing of its own, so fetching a live Alpaca price server-side
    // would leave avg cost and UI current price out of sync (e.g. AAPL
    // shown as $182.63 but booked at Alpaca's live ~$265 → bogus -31%
    // return). Market-hours check is also bypassed so paper trading works
    // any time the user opens the app in dev.
    //
    // In prod we keep Alpaca as the authoritative price source and ignore
    // the client-supplied price entirely to prevent clients from
    // manipulating fills.
    const isTestMode = ['test', 'demo'].includes(process.env.BEANSTALK_ENVIRONMENT)

    let tradePrice
    if (isTestMode && typeof clientPrice === 'number' && clientPrice > 0) {
      tradePrice = clientPrice
    } else {
      // Check market hours
      const marketClock = await alpacaService.getMarketClock()
      if (!marketClock.is_open) {
        return res.status(400).json({ error: 'Market is closed. Trading is only allowed during market hours (9:30 AM - 4:00 PM ET)' })
      }

      // Get current price from Alpaca
      const currentPriceData = await alpacaService.getPrice(symbol)
      tradePrice = currentPriceData.price
    }

    let transaction
    if (action === 'buy') {
      transaction = await portfolioService.executeBuyTrade(portfolio.portfolio_id, symbol, quantity, tradePrice)
    } else {
      transaction = await portfolioService.executeSellTrade(portfolio.portfolio_id, symbol, quantity, tradePrice)
    }

    const updatedPortfolio = await portfolioService.getPortfolio(portfolio.portfolio_id)

    res.json({
      transaction_id: transaction.transaction_id,
      status: 'completed',
      action: action,
      symbol: symbol,
      quantity: quantity,
      price: tradePrice,
      total_amount: transaction.amount,
      portfolio_id: portfolio.portfolio_id,
      portfolio_type: portfolio.portfolio_type,
      contest_id: portfolio.contest_id || null,
      portfolio_updated: {
        cash_balance: updatedPortfolio.current_cash_balance,
        total_value: updatedPortfolio.total_portfolio_value,
        position_count: updatedPortfolio.position_count,
      },
    })
  } catch (error) {
    console.error('Trade execution error:', error)

    if (error.message.includes('Insufficient')) {
      return res.status(400).json({ error: error.message })
    }

    res.status(500).json({ error: 'Failed to execute trade' })
  }
}

/**
 * GET /api/portfolio/:userId/transactions
 * Get transaction history
 */
async function getTransactions(req, res) {
  try {
    const { userId } = req.params
    const { limit = 50, offset = 0, type, portfolio_id, contest_id } = req.query

    if (req.user.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { portfolio, error } = await resolveUserPortfolio(userId, { portfolio_id, contest_id })
    if (error) {
      return res.status(error.status).json({ error: error.message })
    }

    const options = {
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      ...(type && { type }),
    }

    const transactions = await portfolioService.getPortfolioTransactions(portfolio.portfolio_id, options)

    res.json({
      portfolio_id: portfolio.portfolio_id,
      portfolio_type: portfolio.portfolio_type,
      contest_id: portfolio.contest_id || null,
      count: transactions.length,
      transactions: transactions,
    })
  } catch (error) {
    console.error('Transaction fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
}

/**
 * PUT /api/portfolio/:portfolioId/update-prices
 * Update portfolio with latest market prices
 */
async function updatePrices(req, res) {
  try {
    const { portfolioId } = req.params
    let { priceMap } = req.body

    // If no priceMap provided, fetch real-time prices from Alpaca
    if (!priceMap || Object.keys(priceMap).length === 0) {
      const portfolio = await portfolioService.getPortfolio(portfolioId)
      if (!portfolio || !portfolio.positions || portfolio.positions.length === 0) {
        return res.status(400).json({ error: 'No positions to update or portfolio not found' })
      }

      const symbols = portfolio.positions.map(pos => pos.symbol)
      const prices = await alpacaService.getPrices(symbols)
      priceMap = {}
      prices.forEach(p => {
        priceMap[p.symbol] = p.price
      })
    }

    if (!priceMap || typeof priceMap !== 'object') {
      return res.status(400).json({ error: 'priceMap is required and must be an object' })
    }

    const portfolio = await portfolioService.updatePortfolioPrices(portfolioId, priceMap)

    res.json({
      portfolio_id: portfolio.portfolio_id,
      total_portfolio_value: portfolio.total_portfolio_value,
      total_return_percent: portfolio.total_return_percent,
      daily_return_percent: portfolio.daily_return_percent,
      updated_at: portfolio.updated_at,
    })
  } catch (error) {
    console.error('Price update error:', error)
    res.status(500).json({ error: 'Failed to update prices' })
  }
}

module.exports = {
  getPortfolio,
  executeTrade,
  getTransactions,
  updatePrices,
}
