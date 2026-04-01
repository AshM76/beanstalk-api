/**
 * Portfolio Controller
 * Handles portfolio API requests
 */

const portfolioService = require('../../services/portfolio.service')
const alpacaService = require('../../services/alpaca.service')

/**
 * GET /api/portfolio/:userId
 * Get user's main portfolio
 */
async function getPortfolio(req, res) {
  try {
    const { userId } = req.params

    if (req.user.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const portfolio = await portfolioService.getUserMainPortfolio(userId)

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' })
    }

    // Calculate performance metrics
    const metrics = await portfolioService.calculatePerformanceMetrics(portfolio.portfolio_id)

    res.json({
      portfolio_id: portfolio.portfolio_id,
      user_id: portfolio.user_id,
      starting_balance: portfolio.starting_balance,
      current_balance: portfolio.current_cash_balance,
      invested_value: portfolio.total_position_value,
      total_value: portfolio.total_portfolio_value,
      total_return_percent: portfolio.total_return_percent,
      total_return_amount: portfolio.total_return_amount,
      positions: portfolio.positions,
      metrics: metrics,
      updated_at: portfolio.updated_at,
    })
  } catch (error) {
    console.error('Portfolio fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch portfolio' })
  }
}

/**
 * POST /api/portfolio/:userId/trade
 * Execute buy or sell trade
 */
async function executeTrade(req, res) {
  try {
    const { userId } = req.params
    const { action, symbol, quantity, price } = req.body

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

    // Get user's portfolio
    const portfolio = await portfolioService.getUserMainPortfolio(userId)

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' })
    }

    // Check market hours
    const marketClock = await alpacaService.getMarketClock()
    if (!marketClock.is_open) {
      return res.status(400).json({ error: 'Market is closed. Trading is only allowed during market hours (9:30 AM - 4:00 PM ET)' })
    }

    // Get current price from Alpaca
    const currentPriceData = await alpacaService.getPrice(symbol)
    const currentPrice = currentPriceData.price

    // Use current price for trade execution
    const tradePrice = currentPrice

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
    const { limit = 50, offset = 0, type } = req.query

    if (req.user.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const portfolio = await portfolioService.getUserMainPortfolio(userId)

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' })
    }

    const options = {
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      ...(type && { type }),
    }

    const transactions = await portfolioService.getPortfolioTransactions(portfolio.portfolio_id, options)

    res.json({
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
