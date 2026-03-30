const Alpaca = require('@alpacahq/alpaca-trade-api')

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
})

// GET /api/trading/account
async function getAccount(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getAccount')

  try {
    const account = await alpaca.getAccount()
    return res.status(200).send({
      data: {
        id: account.id,
        status: account.status,
        currency: account.currency,
        buying_power: account.buying_power,
        cash: account.cash,
        portfolio_value: account.portfolio_value,
        equity: account.equity,
      },
      error: false,
      message: 'Account loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// GET /api/trading/portfolio
async function getPortfolio(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getPortfolio')

  try {
    const positions = await alpaca.getPositions()
    return res.status(200).send({
      data: positions.map(p => ({
        symbol: p.symbol,
        qty: p.qty,
        avg_entry_price: p.avg_entry_price,
        current_price: p.current_price,
        market_value: p.market_value,
        unrealized_pl: p.unrealized_pl,
        unrealized_plpc: p.unrealized_plpc,
        side: p.side,
      })),
      error: false,
      message: 'Portfolio loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// GET /api/trading/price/:symbol
async function getStockPrice(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getStockPrice')
  console.log(`:: symbol: ${req.params.symbol}`)

  const symbol = req.params.symbol.toUpperCase()

  try {
    const bars = await alpaca.getBarsV2(symbol, {
      timeframe: '1Day',
      limit: 1,
    })

    const result = []
    for await (const bar of bars) {
      result.push(bar)
    }

    if (!result.length) {
      return res.status(404).send({ error: true, message: `No price data found for ${symbol}` })
    }

    const latest = result[0]
    return res.status(200).send({
      data: {
        symbol,
        open: latest.OpenPrice,
        high: latest.HighPrice,
        low: latest.LowPrice,
        close: latest.ClosePrice,
        volume: latest.Volume,
        timestamp: latest.Timestamp,
      },
      error: false,
      message: `Price data for ${symbol} loaded successfully`,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// POST /api/trading/order
// body: { symbol, qty, side ("buy"|"sell"), type ("market"|"limit"), limit_price? }
async function placeOrder(req, res) {
  console.log(':: POST')
  console.log(':: TRADING/placeOrder')
  console.log(req.body)

  const { symbol, qty, side, type, limit_price } = req.body

  if (!symbol || !qty || !side || !type) {
    return res.status(400).send({ error: true, message: 'symbol, qty, side, and type are required' })
  }

  try {
    const orderParams = {
      symbol: symbol.toUpperCase(),
      qty: Number(qty),
      side,           // 'buy' or 'sell'
      type,           // 'market' or 'limit'
      time_in_force: 'day',
    }

    if (type === 'limit') {
      if (!limit_price) {
        return res.status(400).send({ error: true, message: 'limit_price is required for limit orders' })
      }
      orderParams.limit_price = Number(limit_price)
    }

    const order = await alpaca.createOrder(orderParams)
    return res.status(200).send({
      data: {
        id: order.id,
        symbol: order.symbol,
        qty: order.qty,
        side: order.side,
        type: order.type,
        status: order.status,
        submitted_at: order.submitted_at,
      },
      error: false,
      message: `${side.toUpperCase()} order for ${qty} share(s) of ${symbol.toUpperCase()} submitted successfully`,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// GET /api/trading/orders
async function getOrders(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getOrders')

  try {
    const orders = await alpaca.getOrders({ status: 'all', limit: 50 })
    return res.status(200).send({
      data: orders.map(o => ({
        id: o.id,
        symbol: o.symbol,
        qty: o.qty,
        side: o.side,
        type: o.type,
        status: o.status,
        submitted_at: o.submitted_at,
        filled_at: o.filled_at,
        filled_avg_price: o.filled_avg_price,
      })),
      error: false,
      message: 'Orders loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

module.exports = { getAccount, getPortfolio, getStockPrice, placeOrder, getOrders }
