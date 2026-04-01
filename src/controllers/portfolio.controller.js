/**
 * Portfolio Controller
 * Handles portfolio API requests
 */

const portfolioService = require('../../services/portfolio.service')

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

    if (!symbol || !quantity || !price) {
      return res.status(400).json({ error: 'Missing required fields: symbol, quantity, price' })
    }

    if (quantity <= 0 || price <= 0) {
      return res.status(400).json({ error: 'Quantity and price must be positive' })
    }

    // Get user's portfolio
    const portfolio = await portfolioService.getUserMainPortfolio(userId)

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' })
    }

    let transaction

    if (action === 'buy') {
      transaction = await portfolioService.executeBuyTrade(portfolio.portfolio_id, symbol, quantity, price)
    } else {
      transaction = await portfolioService.executeSellTrade(portfolio.portfolio_id, symbol, quantity, price)
    }

    const updatedPortfolio = await portfolioService.getPortfolio(portfolio.portfolio_id)

    res.json({
      transaction_id: transaction.transaction_id,
      status: 'completed',
      action: action,
      symbol: symbol,
      quantity: quantity,
      price: price,
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
    const { priceMap } = req.body

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
