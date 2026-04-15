/**
 * Portfolio Service
 * Handles portfolio operations: creation, trading, valuation, performance tracking
 *
 * Persistence: Google BigQuery.
 *   Tables (see migrations/005_add_portfolio_tables.sql):
 *     - `${dataset}.portfolio`             (one row per portfolio; positions embedded as REPEATED RECORD)
 *     - `${dataset}.portfolio_transaction` (one row per buy/sell/dividend/deposit/withdrawal)
 *
 * All queries are parameterized to avoid SQL injection. The `positions` array is
 * written as a single struct-array parameter; because BigQuery's UPDATE DML cannot
 * append to a REPEATED field using parameters alone, we replace the entire array
 * on every portfolio mutation. This is consistent with how the service layer
 * reads a portfolio, mutates in memory, then writes it back.
 */

const { v4: uuidv4 } = require('uuid')
const { BigQuery } = require('@google-cloud/bigquery')

const {
  BEANSTALK_GCP_BIGQUERY_PROJECTID,
  BEANSTALK_GCP_BIGQUERY_DATASETID,
} = process.env

const keyFilename = './src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json'
const bigquery = new BigQuery({
  projectId: BEANSTALK_GCP_BIGQUERY_PROJECTID,
  keyFilename,
})

const DATASET = BEANSTALK_GCP_BIGQUERY_DATASETID
const PORTFOLIO_TABLE = `\`${BEANSTALK_GCP_BIGQUERY_PROJECTID}.${DATASET}.portfolio\``
const TRANSACTION_TABLE = `\`${BEANSTALK_GCP_BIGQUERY_PROJECTID}.${DATASET}.portfolio_transaction\``

// BigQuery DATETIME expects 'YYYY-MM-DD HH:MM:SS[.ffffff]' (no TZ). Convert JS Date.
function toBqDatetime(value) {
  if (value === null || value === undefined) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  // Use UTC ISO then strip the 'T' and trailing 'Z'
  return d.toISOString().replace('T', ' ').replace('Z', '')
}

// Map a portfolio object (with JS Dates) to BigQuery-friendly row shape.
function portfolioToRow(p) {
  return {
    portfolio_id: p.portfolio_id,
    user_id: p.user_id,
    portfolio_type: p.portfolio_type,
    contest_id: p.contest_id || null,
    starting_balance: p.starting_balance,
    current_cash_balance: p.current_cash_balance,
    total_invested: p.total_invested ?? 0,
    total_position_value: p.total_position_value ?? 0,
    total_portfolio_value: p.total_portfolio_value,
    total_return_amount: p.total_return_amount ?? 0,
    total_return_percent: p.total_return_percent ?? 0,
    daily_return_percent: p.daily_return_percent ?? 0,
    highest_portfolio_value: p.highest_portfolio_value ?? p.starting_balance,
    lowest_portfolio_value: p.lowest_portfolio_value ?? p.starting_balance,
    positions: (p.positions || []).map(pos => ({
      position_id: pos.position_id,
      symbol: pos.symbol,
      quantity: pos.quantity,
      purchase_price: pos.purchase_price,
      purchase_date: toBqDatetime(pos.purchase_date),
      current_price: pos.current_price ?? pos.purchase_price,
      current_value: pos.current_value ?? pos.quantity * pos.purchase_price,
      unrealized_gain_loss: pos.unrealized_gain_loss ?? 0,
      unrealized_gain_loss_percent: pos.unrealized_gain_loss_percent ?? 0,
      updated_at: toBqDatetime(pos.updated_at || new Date()),
    })),
    position_count: p.position_count ?? (p.positions || []).length,
    created_at: toBqDatetime(p.created_at),
    updated_at: toBqDatetime(p.updated_at),
    last_price_update: toBqDatetime(p.last_price_update),
  }
}

// Normalize a row read from BigQuery back to JS objects (BigQuery returns
// DATETIME as { value: 'YYYY-MM-DD HH:MM:SS' } objects).
function rowToPortfolio(row) {
  if (!row) return null
  const toDate = v => {
    if (v === null || v === undefined) return null
    if (v instanceof Date) return v
    if (typeof v === 'object' && v.value) return new Date(v.value.replace(' ', 'T') + 'Z')
    return new Date(v)
  }
  const toNum = v => (v === null || v === undefined ? null : Number(v))
  return {
    portfolio_id: row.portfolio_id,
    user_id: row.user_id,
    portfolio_type: row.portfolio_type,
    contest_id: row.contest_id || null,
    starting_balance: toNum(row.starting_balance),
    current_cash_balance: toNum(row.current_cash_balance),
    total_invested: toNum(row.total_invested),
    total_position_value: toNum(row.total_position_value),
    total_portfolio_value: toNum(row.total_portfolio_value),
    total_return_amount: toNum(row.total_return_amount),
    total_return_percent: toNum(row.total_return_percent),
    daily_return_percent: toNum(row.daily_return_percent),
    highest_portfolio_value: toNum(row.highest_portfolio_value),
    lowest_portfolio_value: toNum(row.lowest_portfolio_value),
    positions: (row.positions || []).map(pos => ({
      position_id: pos.position_id,
      symbol: pos.symbol,
      quantity: toNum(pos.quantity),
      purchase_price: toNum(pos.purchase_price),
      purchase_date: toDate(pos.purchase_date),
      current_price: toNum(pos.current_price),
      current_value: toNum(pos.current_value),
      unrealized_gain_loss: toNum(pos.unrealized_gain_loss),
      unrealized_gain_loss_percent: toNum(pos.unrealized_gain_loss_percent),
      updated_at: toDate(pos.updated_at),
    })),
    position_count: row.position_count ?? 0,
    created_at: toDate(row.created_at),
    updated_at: toDate(row.updated_at),
    last_price_update: toDate(row.last_price_update),
  }
}

/**
 * Create a new portfolio for a user
 * @param {string} userId - User ID
 * @param {number} startingBalance - Initial portfolio balance
 * @param {string} portfolioType - 'main' or 'contest'
 * @param {string} contestId - Contest ID if contest portfolio
 * @returns {Promise<object>} Created portfolio
 */
async function createPortfolio(userId, startingBalance, portfolioType = 'main', contestId = null) {
  // Uniqueness guard: BigQuery has no DB-level uniqueness constraints, so enforce
  // at the app layer. A user must have at most one 'main' portfolio, and at most
  // one portfolio per (user, contest_id) pair. Return the existing row rather
  // than inserting a duplicate — this makes the call idempotent, which is what
  // the contest-join flow and the lazy-create-on-first-fetch flow both want.
  if (portfolioType === 'main') {
    const existing = await fetchUserMainPortfolioFromDatabase(userId)
    if (existing) return existing
  } else if (portfolioType === 'contest') {
    if (!contestId) {
      throw new Error('contestId is required when creating a contest portfolio')
    }
    const existing = await fetchUserContestPortfolioFromDatabase(userId, contestId)
    if (existing) return existing
  }

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
 * Get a user's contest portfolio for a specific contest
 * @param {string} userId - User ID
 * @param {string} contestId - Contest ID
 * @returns {Promise<object|null>} Contest portfolio, or null if user has not joined
 */
async function getUserContestPortfolio(userId, contestId) {
  try {
    return await fetchUserContestPortfolioFromDatabase(userId, contestId)
  } catch (error) {
    console.error('Error fetching user contest portfolio:', error)
    throw error
  }
}

/**
 * List every portfolio for a user (main + any contests they've joined)
 * @param {string} userId - User ID
 * @returns {Promise<array>} Portfolios
 */
async function getUserPortfolios(userId) {
  try {
    return await fetchUserPortfoliosFromDatabase(userId)
  } catch (error) {
    console.error('Error fetching user portfolios:', error)
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

// ─────────────────────────────────────────────────────────────
// BigQuery persistence layer
// ─────────────────────────────────────────────────────────────

// Shared insert/query helpers
async function runQuery(query, params = {}, types = {}) {
  const [rows] = await bigquery.query({
    query,
    params,
    types,
    location: 'US',
    parameterMode: 'named',
  })
  return rows
}

// BigQuery INSERT DML supports struct/array params, which we need for `positions`.
// Streaming insert (bigquery.table(...).insert) would also work but does not
// expose DML transaction semantics; DML is preferred for consistency with updates.
async function savePortfolioToDatabase(portfolio) {
  const row = portfolioToRow(portfolio)
  const query = `
    INSERT INTO ${PORTFOLIO_TABLE} (
      portfolio_id, user_id, portfolio_type, contest_id,
      starting_balance, current_cash_balance,
      total_invested, total_position_value, total_portfolio_value,
      total_return_amount, total_return_percent, daily_return_percent,
      highest_portfolio_value, lowest_portfolio_value,
      positions, position_count,
      created_at, updated_at, last_price_update
    ) VALUES (
      @portfolio_id, @user_id, @portfolio_type, @contest_id,
      @starting_balance, @current_cash_balance,
      @total_invested, @total_position_value, @total_portfolio_value,
      @total_return_amount, @total_return_percent, @daily_return_percent,
      @highest_portfolio_value, @lowest_portfolio_value,
      @positions, @position_count,
      DATETIME(@created_at), DATETIME(@updated_at),
      IF(@last_price_update IS NULL, NULL, DATETIME(@last_price_update))
    )
  `
  const positionType = {
    type: 'ARRAY',
    arrayType: {
      type: 'STRUCT',
      structTypes: [
        { name: 'position_id', type: { type: 'STRING' } },
        { name: 'symbol', type: { type: 'STRING' } },
        { name: 'quantity', type: { type: 'NUMERIC' } },
        { name: 'purchase_price', type: { type: 'NUMERIC' } },
        { name: 'purchase_date', type: { type: 'DATETIME' } },
        { name: 'current_price', type: { type: 'NUMERIC' } },
        { name: 'current_value', type: { type: 'NUMERIC' } },
        { name: 'unrealized_gain_loss', type: { type: 'NUMERIC' } },
        { name: 'unrealized_gain_loss_percent', type: { type: 'NUMERIC' } },
        { name: 'updated_at', type: { type: 'DATETIME' } },
      ],
    },
  }
  await runQuery(query, row, { positions: positionType, contest_id: 'STRING', last_price_update: 'STRING' })
  return portfolio
}

async function fetchPortfolioFromDatabase(portfolioId) {
  const query = `
    SELECT *
    FROM ${PORTFOLIO_TABLE}
    WHERE portfolio_id = @portfolio_id
    LIMIT 1
  `
  const rows = await runQuery(query, { portfolio_id: portfolioId })
  return rows.length > 0 ? rowToPortfolio(rows[0]) : null
}

async function fetchUserMainPortfolioFromDatabase(userId) {
  const query = `
    SELECT *
    FROM ${PORTFOLIO_TABLE}
    WHERE user_id = @user_id AND portfolio_type = 'main'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const rows = await runQuery(query, { user_id: userId })
  return rows.length > 0 ? rowToPortfolio(rows[0]) : null
}

async function fetchUserContestPortfolioFromDatabase(userId, contestId) {
  const query = `
    SELECT *
    FROM ${PORTFOLIO_TABLE}
    WHERE user_id = @user_id AND contest_id = @contest_id AND portfolio_type = 'contest'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const rows = await runQuery(query, { user_id: userId, contest_id: contestId })
  return rows.length > 0 ? rowToPortfolio(rows[0]) : null
}

async function fetchUserPortfoliosFromDatabase(userId) {
  const query = `
    SELECT *
    FROM ${PORTFOLIO_TABLE}
    WHERE user_id = @user_id
    ORDER BY portfolio_type DESC, created_at ASC
  `
  const rows = await runQuery(query, { user_id: userId })
  return rows.map(rowToPortfolio)
}

async function saveTransactionToDatabase(transaction) {
  const query = `
    INSERT INTO ${TRANSACTION_TABLE} (
      transaction_id, portfolio_id, user_id, transaction_type,
      symbol, quantity, price, amount,
      contest_id, contest_entry_fee, prize_amount,
      transaction_date, settlement_date, created_at, status, notes
    ) VALUES (
      @transaction_id, @portfolio_id, @user_id, @transaction_type,
      @symbol, @quantity, @price, @amount,
      @contest_id, @contest_entry_fee, @prize_amount,
      DATETIME(@transaction_date),
      IF(@settlement_date IS NULL, NULL, DATETIME(@settlement_date)),
      DATETIME(@created_at),
      @status, @notes
    )
  `
  const params = {
    transaction_id: transaction.transaction_id,
    portfolio_id: transaction.portfolio_id,
    user_id: transaction.user_id,
    transaction_type: transaction.transaction_type,
    symbol: transaction.symbol || null,
    quantity: transaction.quantity ?? null,
    price: transaction.price ?? null,
    amount: transaction.amount,
    contest_id: transaction.contest_id || null,
    contest_entry_fee: transaction.contest_entry_fee ?? null,
    prize_amount: transaction.prize_amount ?? null,
    transaction_date: toBqDatetime(transaction.transaction_date),
    settlement_date: toBqDatetime(transaction.settlement_date),
    created_at: toBqDatetime(transaction.created_at),
    status: transaction.status || 'completed',
    notes: transaction.notes || null,
  }
  const types = {
    symbol: 'STRING',
    quantity: 'NUMERIC',
    price: 'NUMERIC',
    contest_id: 'STRING',
    contest_entry_fee: 'NUMERIC',
    prize_amount: 'NUMERIC',
    settlement_date: 'STRING',
    notes: 'STRING',
  }
  await runQuery(query, params, types)
  return transaction
}

async function updatePortfolioInDatabase(portfolio) {
  // Full-row update: BigQuery can't append to REPEATED fields via params, so we
  // always replace the entire positions array and recomputed aggregates.
  const row = portfolioToRow(portfolio)
  const query = `
    UPDATE ${PORTFOLIO_TABLE}
    SET
      current_cash_balance      = @current_cash_balance,
      total_invested            = @total_invested,
      total_position_value      = @total_position_value,
      total_portfolio_value     = @total_portfolio_value,
      total_return_amount       = @total_return_amount,
      total_return_percent      = @total_return_percent,
      daily_return_percent      = @daily_return_percent,
      highest_portfolio_value   = @highest_portfolio_value,
      lowest_portfolio_value    = @lowest_portfolio_value,
      positions                 = @positions,
      position_count            = @position_count,
      updated_at                = DATETIME(@updated_at),
      last_price_update         = IF(@last_price_update IS NULL, NULL, DATETIME(@last_price_update))
    WHERE portfolio_id = @portfolio_id
  `
  const positionType = {
    type: 'ARRAY',
    arrayType: {
      type: 'STRUCT',
      structTypes: [
        { name: 'position_id', type: { type: 'STRING' } },
        { name: 'symbol', type: { type: 'STRING' } },
        { name: 'quantity', type: { type: 'NUMERIC' } },
        { name: 'purchase_price', type: { type: 'NUMERIC' } },
        { name: 'purchase_date', type: { type: 'DATETIME' } },
        { name: 'current_price', type: { type: 'NUMERIC' } },
        { name: 'current_value', type: { type: 'NUMERIC' } },
        { name: 'unrealized_gain_loss', type: { type: 'NUMERIC' } },
        { name: 'unrealized_gain_loss_percent', type: { type: 'NUMERIC' } },
        { name: 'updated_at', type: { type: 'DATETIME' } },
      ],
    },
  }
  await runQuery(query, row, { positions: positionType, last_price_update: 'STRING' })
  return portfolio
}

async function fetchPortfolioTransactionsFromDatabase(portfolioId, options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 500)
  const offset = Math.max(parseInt(options.offset, 10) || 0, 0)
  const typeFilter = options.type || null

  let query = `
    SELECT *
    FROM ${TRANSACTION_TABLE}
    WHERE portfolio_id = @portfolio_id
  `
  if (typeFilter) {
    query += ` AND transaction_type = @transaction_type`
  }
  query += `
    ORDER BY transaction_date DESC
    LIMIT @limit OFFSET @offset
  `

  const params = {
    portfolio_id: portfolioId,
    limit,
    offset,
    ...(typeFilter ? { transaction_type: typeFilter } : {}),
  }
  const types = {
    limit: 'INT64',
    offset: 'INT64',
  }

  const rows = await runQuery(query, params, types)
  return rows.map(r => ({
    ...r,
    transaction_date: r.transaction_date && r.transaction_date.value
      ? new Date(r.transaction_date.value.replace(' ', 'T') + 'Z')
      : r.transaction_date,
    settlement_date: r.settlement_date && r.settlement_date.value
      ? new Date(r.settlement_date.value.replace(' ', 'T') + 'Z')
      : r.settlement_date,
    created_at: r.created_at && r.created_at.value
      ? new Date(r.created_at.value.replace(' ', 'T') + 'Z')
      : r.created_at,
  }))
}

module.exports = {
  createPortfolio,
  getPortfolio,
  getUserMainPortfolio,
  getUserContestPortfolio,
  getUserPortfolios,
  executeBuyTrade,
  executeSellTrade,
  updatePortfolioPrices,
  getPortfolioTransactions,
  calculatePerformanceMetrics,
}

// Dev/test bypass: when running without GCP credentials, back the service with
// an in-memory store so the mobile app can be exercised end-to-end.
if (process.env.BEANSTALK_ENVIRONMENT === 'test') {
  module.exports = require('./_memory_store').portfolio
  console.log('[Beanstalk] :: portfolio.service → in-memory store (test mode)')
}
