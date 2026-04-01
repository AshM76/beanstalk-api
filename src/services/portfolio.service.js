/**
 * Portfolio Service
 * Handles portfolio operations: creation, trading, valuation, performance tracking
 */

const { v4: uuidv4 } = require('uuid')

/**
 * Create a new portfolio for a user
 * @param {string} userId - User ID
 * @param {number} startingBalance - Initial portfolio balance
 * @param {string} portfolioType - 'main' or 'contest'
 * @param {string} contestId - Contest ID if contest portfolio
 * @returns {Promise<object>} Created portfolio
 */
async function createPortfolio(userId, startingBalance, portfolioType = 'main', contestId = null) {
  const portfolio = {
    portfolio_id: uuidv4(),
    user_id: userId,
    portfolio_type: portfolioType,
    contest_id: contestId,
    starting_balance: startingBalance,
    current_cash_balance: startingBalance,
    total_invested: 0,
    total_position_value: 0,
    total_portfolio_value: startingBalance,
    total_return_amount: 0,
    total_return_percent: 0,
    daily_return_percent: 0,
    highest_portfolio_value: startingBalance,
    lowest_portfolio_value: startingBalance,
    positions: [],
    position_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    last_price_update: null,
  }

  // Save to BigQuery
  try {
    await savePortfolioToDatabase(portfolio)
    return portfolio
  } catch (error) {
    console.error('Error creating portfolio:', error)
    throw error
  }
}

/**
 * Get portfolio by ID or user
 * @param {string} portfolioId - Portfolio ID
 * @returns {Promise<object>} Portfolio object
 */
async function getPortfolio(portfolioId) {
  try {
    const portfolio = await fetchPortfolioFromDatabase(portfolioId)
    if (!portfolio) {
      return null
    }
    return portfolio
  } catch (error) {
    console.error('Error fetching portfolio:', error)
    throw error
  }
}

/**
 * Get user's main portfolio
 * @param {string} userId - User ID
 * @returns {Promise<object>} Main portfolio
 */
async function getUserMainPortfolio(userId) {
  try {
    const portfolio = await fetchUserMainPortfolioFromDatabase(userId)
    return portfolio
  } catch (error) {
    console.error('Error fetching user main portfolio:', error)
    throw error
  }
}

/**
 * Execute a buy trade
 * @param {string} portfolioId - Portfolio ID
 * @param {string} symbol - Share symbol (e.g., 'AAPL')
 * @param {number} quantity - Number of shares
 * @param {number} price - Price per share
 * @returns {Promise<object>} Created transaction
 */
async function executeBuyTrade(portfolioId, symbol, quantity, price) {
  const portfolio = await getPortfolio(portfolioId)

  if (!portfolio) {
    throw new Error('Portfolio not found')
  }

  const totalCost = quantity * price

  if (portfolio.current_cash_balance < totalCost) {
    throw new Error('Insufficient cash balance for this trade')
  }

  const transaction = {
    transaction_id: uuidv4(),
    portfolio_id: portfolioId,
    user_id: portfolio.user_id,
    transaction_type: 'buy',
    symbol: symbol,
    quantity: quantity,
    price: price,
    amount: totalCost,
    transaction_date: new Date(),
    settlement_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // T+2
    created_at: new Date(),
    status: 'completed',
  }

  try {
    // Save transaction
    await saveTransactionToDatabase(transaction)

    // Update portfolio: add position or increase existing
    const existingPosition = portfolio.positions.find(p => p.symbol === symbol)

    if (existingPosition) {
      // Average cost calculation
      const totalShares = existingPosition.quantity + quantity
      const totalValue = existingPosition.quantity * existingPosition.purchase_price + totalCost
      const newAvgCost = totalValue / totalShares

      existingPosition.quantity = totalShares
      existingPosition.purchase_price = newAvgCost
      existingPosition.updated_at = new Date()
    } else {
      // Create new position
      const position = {
        position_id: uuidv4(),
        symbol: symbol,
        quantity: quantity,
        purchase_price: price,
        purchase_date: new Date(),
        current_price: price,
        current_value: totalCost,
        unrealized_gain_loss: 0,
        unrealized_gain_loss_percent: 0,
        updated_at: new Date(),
      }
      portfolio.positions.push(position)
      portfolio.position_count++
    }

    // Update portfolio balances
    portfolio.current_cash_balance -= totalCost
    portfolio.total_invested += totalCost
    portfolio.total_position_value += totalCost
    portfolio.total_portfolio_value = portfolio.current_cash_balance + portfolio.total_position_value
    portfolio.updated_at = new Date()

    // Save updated portfolio
    await updatePortfolioInDatabase(portfolio)

    return transaction
  } catch (error) {
    console.error('Error executing buy trade:', error)
    throw error
  }
}

/**
 * Execute a sell trade
 * @param {string} portfolioId - Portfolio ID
 * @param {string} symbol - Share symbol
 * @param {number} quantity - Number of shares to sell
 * @param {number} price - Current price per share
 * @returns {Promise<object>} Created transaction
 */
async function executeSellTrade(portfolioId, symbol, quantity, price) {
  const portfolio = await getPortfolio(portfolioId)

  if (!portfolio) {
    throw new Error('Portfolio not found')
  }

  const position = portfolio.positions.find(p => p.symbol === symbol)

  if (!position || position.quantity < quantity) {
    throw new Error('Insufficient shares to sell')
  }

  const proceeds = quantity * price

  const transaction = {
    transaction_id: uuidv4(),
    portfolio_id: portfolioId,
    user_id: portfolio.user_id,
    transaction_type: 'sell',
    symbol: symbol,
    quantity: quantity,
    price: price,
    amount: proceeds,
    transaction_date: new Date(),
    settlement_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // T+2
    created_at: new Date(),
    status: 'completed',
  }

  try {
    // Save transaction
    await saveTransactionToDatabase(transaction)

    // Calculate realized gain/loss
    const costBasis = position.purchase_price * quantity
    const realizedGainLoss = proceeds - costBasis

    // Update position
    position.quantity -= quantity

    if (position.quantity === 0) {
      // Remove position if fully sold
      portfolio.positions = portfolio.positions.filter(p => p.symbol !== symbol)
      portfolio.position_count--
    } else {
      position.updated_at = new Date()
    }

    // Update portfolio balances
    portfolio.current_cash_balance += proceeds
    portfolio.total_invested -= costBasis
    portfolio.total_position_value -= costBasis
    portfolio.total_portfolio_value = portfolio.current_cash_balance + portfolio.total_position_value
    portfolio.updated_at = new Date()

    // Save updated portfolio
    await updatePortfolioInDatabase(portfolio)

    return transaction
  } catch (error) {
    console.error('Error executing sell trade:', error)
    throw error
  }
}

/**
 * Update portfolio with latest market prices
 * @param {string} portfolioId - Portfolio ID
 * @param {object} priceMap - Map of symbol -> currentPrice
 */
async function updatePortfolioPrices(portfolioId, priceMap) {
  const portfolio = await getPortfolio(portfolioId)

  if (!portfolio) {
    throw new Error('Portfolio not found')
  }

  let totalPositionValue = 0

  portfolio.positions.forEach(position => {
    if (priceMap[position.symbol]) {
      const currentPrice = priceMap[position.symbol]
      const currentValue = position.quantity * currentPrice
      const gainLoss = currentValue - (position.quantity * position.purchase_price)
      const gainLossPercent = (gainLoss / (position.quantity * position.purchase_price)) * 100

      position.current_price = currentPrice
      position.current_value = currentValue
      position.unrealized_gain_loss = gainLoss
      position.unrealized_gain_loss_percent = gainLossPercent
      position.updated_at = new Date()

      totalPositionValue += currentValue
    }
  })

  const oldPortfolioValue = portfolio.total_portfolio_value
  portfolio.total_position_value = totalPositionValue
  portfolio.total_portfolio_value = portfolio.current_cash_balance + totalPositionValue

  // Calculate returns
  portfolio.total_return_amount = portfolio.total_portfolio_value - portfolio.starting_balance
  portfolio.total_return_percent = (portfolio.total_return_amount / portfolio.starting_balance) * 100
  portfolio.daily_return_percent = ((portfolio.total_portfolio_value - oldPortfolioValue) / oldPortfolioValue) * 100

  // Update high/low watermarks
  if (portfolio.total_portfolio_value > portfolio.highest_portfolio_value) {
    portfolio.highest_portfolio_value = portfolio.total_portfolio_value
  }
  if (portfolio.total_portfolio_value < portfolio.lowest_portfolio_value) {
    portfolio.lowest_portfolio_value = portfolio.total_portfolio_value
  }

  portfolio.last_price_update = new Date()
  portfolio.updated_at = new Date()

  try {
    await updatePortfolioInDatabase(portfolio)
    return portfolio
  } catch (error) {
    console.error('Error updating portfolio prices:', error)
    throw error
  }
}

/**
 * Get portfolio transaction history
 * @param {string} portfolioId - Portfolio ID
 * @param {object} options - Filter options (limit, offset, type)
 * @returns {Promise<array>} Transactions
 */
async function getPortfolioTransactions(portfolioId, options = {}) {
  try {
    const transactions = await fetchPortfolioTransactionsFromDatabase(portfolioId, options)
    return transactions
  } catch (error) {
    console.error('Error fetching transactions:', error)
    throw error
  }
}

/**
 * Calculate portfolio performance metrics
 * @param {string} portfolioId - Portfolio ID
 * @returns {Promise<object>} Performance metrics
 */
async function calculatePerformanceMetrics(portfolioId) {
  const portfolio = await getPortfolio(portfolioId)

  if (!portfolio) {
    throw new Error('Portfolio not found')
  }

  const metrics = {
    total_return_percent: portfolio.total_return_percent,
    total_return_amount: portfolio.total_return_amount,
    daily_return_percent: portfolio.daily_return_percent,
    current_portfolio_value: portfolio.total_portfolio_value,
    starting_balance: portfolio.starting_balance,
    highest_value: portfolio.highest_portfolio_value,
    lowest_value: portfolio.lowest_portfolio_value,
    cash_balance: portfolio.current_cash_balance,
    invested_value: portfolio.total_position_value,
    number_of_positions: portfolio.position_count,
    positions: portfolio.positions.map(p => ({
      symbol: p.symbol,
      quantity: p.quantity,
      current_price: p.current_price,
      current_value: p.current_value,
      gain_loss_percent: p.unrealized_gain_loss_percent,
    })),
  }

  return metrics
}

// Database helper functions (placeholders - implement with BigQuery client)
async function savePortfolioToDatabase(portfolio) {
  // TODO: Implement BigQuery insert
  return portfolio
}

async function fetchPortfolioFromDatabase(portfolioId) {
  // TODO: Implement BigQuery query
  return null
}

async function fetchUserMainPortfolioFromDatabase(userId) {
  // TODO: Implement BigQuery query
  return null
}

async function saveTransactionToDatabase(transaction) {
  // TODO: Implement BigQuery insert
  return transaction
}

async function updatePortfolioInDatabase(portfolio) {
  // TODO: Implement BigQuery update
  return portfolio
}

async function fetchPortfolioTransactionsFromDatabase(portfolioId, options) {
  // TODO: Implement BigQuery query with filters
  return []
}

module.exports = {
  createPortfolio,
  getPortfolio,
  getUserMainPortfolio,
  executeBuyTrade,
  executeSellTrade,
  updatePortfolioPrices,
  getPortfolioTransactions,
  calculatePerformanceMetrics,
}
