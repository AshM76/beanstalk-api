/**
 * Portfolio Model Schema
 * Represents a user's virtual/paper trading portfolio
 */

const positionSchema = [
  { name: 'position_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
  { name: 'quantity', type: 'NUMERIC', mode: 'REQUIRED' },
  { name: 'purchase_price', type: 'NUMERIC', mode: 'REQUIRED' },
  { name: 'purchase_date', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'current_price', type: 'NUMERIC' },
  { name: 'current_value', type: 'NUMERIC' },
  { name: 'unrealized_gain_loss', type: 'NUMERIC' },
  { name: 'unrealized_gain_loss_percent', type: 'NUMERIC' },
  { name: 'updated_at', type: 'DATETIME' },
]

const portfolioSchema = [
  // ── Core Portfolio ─────────────────────────────────────────────
  { name: 'portfolio_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'portfolio_type', type: 'STRING', mode: 'REQUIRED' }, // 'main' | 'contest'
  { name: 'contest_id', type: 'STRING' }, // null if main portfolio, contest_id if contest portfolio

  // ── Balances ───────────────────────────────────────────────────
  { name: 'starting_balance', type: 'NUMERIC', mode: 'REQUIRED' },
  { name: 'current_cash_balance', type: 'NUMERIC', mode: 'REQUIRED' },
  { name: 'total_invested', type: 'NUMERIC' }, // Sum of all position purchases
  { name: 'total_position_value', type: 'NUMERIC' }, // Market value of all positions
  { name: 'total_portfolio_value', type: 'NUMERIC', mode: 'REQUIRED' }, // cash + positions

  // ── Performance Metrics ────────────────────────────────────────
  { name: 'total_return_amount', type: 'NUMERIC' }, // Total gain/loss in dollars
  { name: 'total_return_percent', type: 'NUMERIC' }, // Total return as percentage
  { name: 'daily_return_percent', type: 'NUMERIC' }, // Return for current day
  { name: 'highest_portfolio_value', type: 'NUMERIC' }, // Peak portfolio value
  { name: 'lowest_portfolio_value', type: 'NUMERIC' }, // Lowest portfolio value

  // ── Holdings ───────────────────────────────────────────────────
  { name: 'positions', type: 'RECORD', mode: 'REPEATED', fields: positionSchema },
  { name: 'position_count', type: 'INTEGER' }, // Number of active positions

  // ── Timestamps ────────────────────────────────────────────────
  { name: 'created_at', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'updated_at', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'last_price_update', type: 'DATETIME' }, // Last time prices were refreshed from market data
]

const transactionSchema = [
  // ── Core Transaction ──────────────────────────────────────────
  { name: 'transaction_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'portfolio_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'transaction_type', type: 'STRING', mode: 'REQUIRED' }, // 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdrawal'

  // ── Trade Details (for buy/sell) ───────────────────────────────
  { name: 'symbol', type: 'STRING' }, // null for deposits/withdrawals
  { name: 'quantity', type: 'NUMERIC' },
  { name: 'price', type: 'NUMERIC' },
  { name: 'amount', type: 'NUMERIC', mode: 'REQUIRED' }, // Total transaction value

  // ── Contest Info ───────────────────────────────────────────────
  { name: 'contest_id', type: 'STRING' }, // if contest-related transaction
  { name: 'contest_entry_fee', type: 'NUMERIC' }, // if contest entry
  { name: 'prize_amount', type: 'NUMERIC' }, // if contest prize

  // ── Timestamps ────────────────────────────────────────────────
  { name: 'transaction_date', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'settlement_date', type: 'DATETIME' }, // When transaction settles (T+2 for stocks)
  { name: 'created_at', type: 'DATETIME', mode: 'REQUIRED' },

  // ── Status ────────────────────────────────────────────────────
  { name: 'status', type: 'STRING' }, // 'pending' | 'completed' | 'failed'
  { name: 'notes', type: 'STRING' },
]

module.exports = {
  portfolioSchema,
  positionSchema,
  transactionSchema,
}
