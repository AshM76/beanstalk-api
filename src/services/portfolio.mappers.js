/**
 * Pure mappers between our in-memory portfolio shape and BigQuery-friendly
 * rows. Extracted into their own module so unit tests can exercise them
 * without pulling in the service entry point (which transitively loads
 * the Alpaca SDK and mutates process.env via dotenv).
 */

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
      asset_class: pos.asset_class ?? null,
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
      asset_class: pos.asset_class ?? null,
    })),
    position_count: row.position_count ?? 0,
    created_at: toDate(row.created_at),
    updated_at: toDate(row.updated_at),
    last_price_update: toDate(row.last_price_update),
  }
}

module.exports = { portfolioToRow, rowToPortfolio, toBqDatetime }
