const Alpaca = require('@alpacahq/alpaca-trade-api')

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
})

// Watchlist of popular stocks used for Top Movers
const TOP_STOCKS = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AMD',
  'NFLX','INTC','DIS','BABA','UBER','SHOP','PYPL','SQ',
  'COIN','PLTR','SOFI','RBLX',
]

// Major crypto pairs
const CRYPTO_SYMBOLS = [
  { symbol: 'BTCUSD', name: 'Bitcoin',      display: 'BTC/USD' },
  { symbol: 'ETHUSD', name: 'Ethereum',     display: 'ETH/USD' },
  { symbol: 'SOLUSD', name: 'Solana',       display: 'SOL/USD' },
  { symbol: 'DOGEUSD',name: 'Dogecoin',     display: 'DOGE/USD' },
  { symbol: 'LINKUSD',name: 'Chainlink',    display: 'LINK/USD' },
  { symbol: 'LTCUSD', name: 'Litecoin',     display: 'LTC/USD' },
  { symbol: 'BCHUSD', name: 'Bitcoin Cash', display: 'BCH/USD' },
  { symbol: 'AVAXUSD',name: 'Avalanche',    display: 'AVAX/USD' },
]


// ── Account ───────────────────────────────────────────────────

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

// GET /api/trading/account/history
// query: period (1D|1W|1M|3M|1A), timeframe (1Min|5Min|15Min|1H|1D)
async function getAccountHistory(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getAccountHistory')

  const period = req.query.period || '1M'
  const timeframe = req.query.timeframe || '1D'

  try {
    const history = await alpaca.getPortfolioHistory({ period, timeframe, extended_hours: false })
    const points = history.timestamp.map((ts, i) => ({
      timestamp: new Date(ts * 1000).toISOString(),
      equity: history.equity[i],
      profit_loss: history.profit_loss[i],
      profit_loss_pct: history.profit_loss_pct[i],
    }))
    return res.status(200).send({
      data: {
        points,
        base_value: history.base_value,
        timeframe: history.timeframe,
      },
      error: false,
      message: 'Portfolio history loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// GET /api/trading/account/activity
async function getAccountActivity(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getAccountActivity')

  try {
    const activity = await alpaca.getAccountActivities({ activity_type: 'FILL', page_size: 50 })
    return res.status(200).send({
      data: activity.map(a => ({
        id: a.id,
        symbol: a.symbol,
        side: a.side,
        qty: a.qty,
        price: a.price,
        transaction_time: a.transaction_time,
        type: a.activity_type,
      })),
      error: false,
      message: 'Account activity loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}


// ── Market Clock ──────────────────────────────────────────────

// GET /api/trading/clock
async function getMarketClock(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getMarketClock')

  try {
    const clock = await alpaca.getClock()
    return res.status(200).send({
      data: {
        is_open: clock.is_open,
        timestamp: clock.timestamp,
        next_open: clock.next_open,
        next_close: clock.next_close,
        status: clock.is_open ? 'Market is OPEN' : 'Market is CLOSED',
        status_color: clock.is_open ? 'green' : 'red',
      },
      error: false,
      message: 'Market clock loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}


// ── Portfolio ─────────────────────────────────────────────────

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


// ── Stocks ────────────────────────────────────────────────────

// GET /api/trading/price/:symbol
async function getStockPrice(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getStockPrice')
  console.log(`:: symbol: ${req.params.symbol}`)

  const symbol = req.params.symbol.toUpperCase()

  try {
    const snap = await alpaca.getSnapshot(symbol)
    const bar = snap.DailyBar
    const prev = snap.PrevDailyBar
    const change = prev ? ((bar.ClosePrice - prev.ClosePrice) / prev.ClosePrice * 100).toFixed(2) : null

    return res.status(200).send({
      data: {
        symbol,
        open: bar.OpenPrice,
        high: bar.HighPrice,
        low: bar.LowPrice,
        close: bar.ClosePrice,
        volume: bar.Volume,
        timestamp: bar.Timestamp,
        change_pct: change ? Number(change) : null,
        prev_close: prev ? prev.ClosePrice : null,
      },
      error: false,
      message: `Price data for ${symbol} loaded successfully`,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// GET /api/trading/movers
// Top gainers & losers from popular stocks today
async function getTopMovers(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getTopMovers')

  try {
    const snaps = await alpaca.getSnapshots(TOP_STOCKS)

    const stocks = snaps
      .filter(s => s.DailyBar && s.PrevDailyBar)
      .map(s => ({
        symbol: s.symbol,
        price: s.DailyBar.ClosePrice,
        prev_close: s.PrevDailyBar.ClosePrice,
        change: Number((s.DailyBar.ClosePrice - s.PrevDailyBar.ClosePrice).toFixed(2)),
        percent_change: Number(((s.DailyBar.ClosePrice - s.PrevDailyBar.ClosePrice) / s.PrevDailyBar.ClosePrice * 100).toFixed(2)),
        volume: s.DailyBar.Volume,
      }))
      .sort((a, b) => b.percent_change - a.percent_change)

    return res.status(200).send({
      data: {
        gainers: stocks.filter(s => s.percent_change > 0).slice(0, 5),
        losers: stocks.filter(s => s.percent_change < 0).slice(-5).reverse(),
        most_active: [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 5),
      },
      error: false,
      message: 'Top movers loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// GET /api/trading/news  or  GET /api/trading/news/:symbol
async function getNews(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getNews')

  const symbol = req.params.symbol ? req.params.symbol.toUpperCase() : null

  try {
    const params = { limit: 20, sort: 'desc' }
    if (symbol) params.symbols = symbol

    const news = await alpaca.getNews(params)
    return res.status(200).send({
      data: news.map(n => ({
        id: n.ID,
        headline: n.Headline,
        summary: n.Summary,
        author: n.Author,
        source: n.Source,
        url: n.URL,
        images: n.Images || [],
        symbols: n.Symbols || [],
        created_at: n.CreatedAt,
        updated_at: n.UpdatedAt,
      })),
      error: false,
      message: symbol ? `News for ${symbol} loaded successfully` : 'Market news loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}


// ── Orders ────────────────────────────────────────────────────

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
      side,
      type,
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


// ── Crypto ────────────────────────────────────────────────────

// GET /api/trading/crypto/prices
async function getCryptoPrices(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getCryptoPrices')

  try {
    const results = await Promise.all(
      CRYPTO_SYMBOLS.map(async ({ symbol, name, display }) => {
        try {
          const bars = alpaca.getBarsV2(symbol, { timeframe: '1Day', limit: 2 })
          const data = []
          for await (const bar of bars) data.push(bar)
          if (!data.length) return null
          const curr = data[data.length - 1]
          const prev = data.length > 1 ? data[data.length - 2] : null
          const change_pct = prev ? Number(((curr.ClosePrice - prev.ClosePrice) / prev.ClosePrice * 100).toFixed(2)) : null
          return { symbol: display, name, close: curr.ClosePrice, open: curr.OpenPrice, high: curr.HighPrice, low: curr.LowPrice, volume: curr.Volume, change_pct, timestamp: curr.Timestamp }
        } catch {
          return null
        }
      })
    )
    return res.status(200).send({
      data: results.filter(Boolean),
      error: false,
      message: 'Crypto prices loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// GET /api/trading/crypto/price/:symbol  (e.g. BTCUSD or BTC)
async function getCryptoPrice(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getCryptoPrice')

  let input = req.params.symbol.toUpperCase().replace('/', '')
  if (!input.endsWith('USD')) input = input + 'USD'

  const meta = CRYPTO_SYMBOLS.find(c => c.symbol === input) || { symbol: input, name: input, display: input }

  try {
    const bars = alpaca.getBarsV2(meta.symbol, { timeframe: '1Day', limit: 2 })
    const data = []
    for await (const bar of bars) data.push(bar)

    if (!data.length) {
      return res.status(404).send({ error: true, message: `No price data found for ${meta.symbol}` })
    }

    const curr = data[data.length - 1]
    const prev = data.length > 1 ? data[data.length - 2] : null
    const change_pct = prev ? Number(((curr.ClosePrice - prev.ClosePrice) / prev.ClosePrice * 100).toFixed(2)) : null

    return res.status(200).send({
      data: { symbol: meta.display, name: meta.name, open: curr.OpenPrice, high: curr.HighPrice, low: curr.LowPrice, close: curr.ClosePrice, volume: curr.Volume, change_pct, prev_close: prev ? prev.ClosePrice : null, timestamp: curr.Timestamp },
      error: false,
      message: `${meta.display} price loaded successfully`,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// POST /api/trading/crypto/order
// body: { symbol (e.g. "BTCUSD"), qty, side ("buy"|"sell") }
async function placeCryptoOrder(req, res) {
  console.log(':: POST')
  console.log(':: TRADING/placeCryptoOrder')

  let { symbol, qty, side } = req.body

  if (!symbol || !qty || !side) {
    return res.status(400).send({ error: true, message: 'symbol, qty, and side are required' })
  }

  symbol = symbol.toUpperCase().replace('/', '')

  try {
    const order = await alpaca.createOrder({
      symbol,
      qty: Number(qty),
      side,
      type: 'market',
      time_in_force: 'gtc',
    })
    return res.status(200).send({
      data: { id: order.id, symbol: order.symbol, qty: order.qty, side: order.side, type: order.type, status: order.status, submitted_at: order.submitted_at },
      error: false,
      message: `${side.toUpperCase()} order for ${qty} of ${symbol} submitted successfully`,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}


// ── Watchlists ────────────────────────────────────────────────

// GET /api/trading/watchlists
async function getWatchlists(req, res) {
  console.log(':: GET')
  console.log(':: TRADING/getWatchlists')

  try {
    const watchlists = await alpaca.getWatchlists()
    return res.status(200).send({
      data: watchlists.map(w => ({
        id: w.id,
        name: w.name,
        created_at: w.created_at,
        updated_at: w.updated_at,
        assets: (w.assets || []).map(a => ({ symbol: a.symbol, name: a.name })),
      })),
      error: false,
      message: 'Watchlists loaded successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// POST /api/trading/watchlist
// body: { name, symbols: ["AAPL", "TSLA"] }
async function createWatchlist(req, res) {
  console.log(':: POST')
  console.log(':: TRADING/createWatchlist')

  const { name, symbols } = req.body
  if (!name) {
    return res.status(400).send({ error: true, message: 'name is required' })
  }

  try {
    const watchlist = await alpaca.addWatchlist(name, symbols || [])
    return res.status(200).send({
      data: { id: watchlist.id, name: watchlist.name, assets: (watchlist.assets || []).map(a => ({ symbol: a.symbol, name: a.name })) },
      error: false,
      message: `Watchlist "${name}" created successfully`,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// POST /api/trading/watchlist/:id/add
// body: { symbol }
async function addToWatchlist(req, res) {
  console.log(':: POST')
  console.log(':: TRADING/addToWatchlist')

  const { id } = req.params
  const { symbol } = req.body

  if (!symbol) {
    return res.status(400).send({ error: true, message: 'symbol is required' })
  }

  try {
    const watchlist = await alpaca.addToWatchlist(id, symbol.toUpperCase())
    return res.status(200).send({
      data: { id: watchlist.id, name: watchlist.name, assets: (watchlist.assets || []).map(a => ({ symbol: a.symbol, name: a.name })) },
      error: false,
      message: `${symbol.toUpperCase()} added to watchlist`,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// DELETE /api/trading/watchlist/:id/remove/:symbol
async function removeFromWatchlist(req, res) {
  console.log(':: DELETE')
  console.log(':: TRADING/removeFromWatchlist')

  const { id, symbol } = req.params

  try {
    await alpaca.deleteFromWatchlist(id, symbol.toUpperCase())
    return res.status(200).send({ data: null, error: false, message: `${symbol.toUpperCase()} removed from watchlist` })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}

// DELETE /api/trading/watchlist/:id
async function deleteWatchlist(req, res) {
  console.log(':: DELETE')
  console.log(':: TRADING/deleteWatchlist')

  const { id } = req.params

  try {
    await alpaca.deleteWatchlist(id)
    return res.status(200).send({ data: null, error: false, message: 'Watchlist deleted successfully' })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ error: true, message: err.message })
  }
}


module.exports = {
  getAccount, getAccountHistory, getAccountActivity,
  getMarketClock,
  getPortfolio, getStockPrice, getTopMovers, getOrders, placeOrder,
  getNews,
  getCryptoPrices, getCryptoPrice, placeCryptoOrder,
  getWatchlists, createWatchlist, addToWatchlist, removeFromWatchlist, deleteWatchlist,
}
