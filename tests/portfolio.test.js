/**
 * Unit tests for the portfolio schema mappers.
 * Focus: asset_class field is preserved on round-trip, and missing on
 * legacy rows reads as null so the mobile parser can default it.
 *
 * Imports from portfolio.mappers directly rather than portfolio.service,
 * which avoids pulling in the Alpaca SDK (it calls dotenv.config() at
 * module-load time and mutates process.env, which would trigger the
 * in-memory store bypass at the bottom of portfolio.service.js).
 */

const { portfolioToRow, rowToPortfolio } = require('../src/services/portfolio.mappers')

describe('portfolio mapper round-trip', () => {
  const basePortfolio = {
    portfolio_id: 'pf_1',
    user_id: 'user_1',
    portfolio_type: 'main',
    contest_id: null,
    starting_balance: 10000,
    current_cash_balance: 9000,
    total_invested: 1000,
    total_position_value: 1050,
    total_portfolio_value: 10050,
    total_return_amount: 50,
    total_return_percent: 0.5,
    daily_return_percent: 0.1,
    highest_portfolio_value: 10050,
    lowest_portfolio_value: 10000,
    position_count: 1,
    created_at: new Date('2026-04-01T00:00:00Z'),
    updated_at: new Date('2026-04-10T00:00:00Z'),
    last_price_update: new Date('2026-04-10T00:00:00Z'),
  }

  test('asset_class=CRYPTO is preserved through write then read', () => {
    const input = {
      ...basePortfolio,
      positions: [{
        position_id: 'pos_1',
        symbol: 'BTC',
        quantity: 0.05,
        purchase_price: 60000,
        purchase_date: new Date('2026-04-01T00:00:00Z'),
        current_price: 62000,
        current_value: 3100,
        unrealized_gain_loss: 100,
        unrealized_gain_loss_percent: 3.33,
        updated_at: new Date('2026-04-10T00:00:00Z'),
        asset_class: 'CRYPTO',
      }],
    }

    const row = portfolioToRow(input)
    const readBack = rowToPortfolio(row)

    expect(readBack.positions).toHaveLength(1)
    expect(readBack.positions[0].symbol).toBe('BTC')
    expect(readBack.positions[0].asset_class).toBe('CRYPTO')
  })

  test('asset_class=ETF is preserved through write then read', () => {
    const input = {
      ...basePortfolio,
      positions: [{
        position_id: 'pos_2',
        symbol: 'SPY',
        quantity: 5,
        purchase_price: 520,
        purchase_date: new Date('2026-04-01T00:00:00Z'),
        current_price: 525,
        current_value: 2625,
        unrealized_gain_loss: 25,
        unrealized_gain_loss_percent: 0.96,
        updated_at: new Date('2026-04-10T00:00:00Z'),
        asset_class: 'ETF',
      }],
    }

    const readBack = rowToPortfolio(portfolioToRow(input))
    expect(readBack.positions[0].asset_class).toBe('ETF')
  })

  test('legacy position without asset_class reads as null', () => {
    // Simulates a row written to BigQuery before migration 008.
    const legacyRow = {
      ...basePortfolio,
      positions: [{
        position_id: 'pos_3',
        symbol: 'AAPL',
        quantity: 10,
        purchase_price: 180,
        purchase_date: new Date('2026-01-01T00:00:00Z'),
        current_price: 182,
        current_value: 1820,
        unrealized_gain_loss: 20,
        unrealized_gain_loss_percent: 1.11,
        updated_at: new Date('2026-04-10T00:00:00Z'),
        // asset_class intentionally absent
      }],
    }

    const portfolio = rowToPortfolio(legacyRow)
    expect(portfolio.positions[0].asset_class).toBeNull()
  })
})
