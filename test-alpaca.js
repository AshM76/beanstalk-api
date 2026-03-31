require('dotenv').config()
const Alpaca = require('@alpacahq/alpaca-trade-api')

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
})

async function test() {
  console.log('\n── Alpaca Full Integration Test ──\n')

  // 1. Account
  console.log('1. Account...')
  const account = await alpaca.getAccount()
  console.log(`   ✓ Status: ${account.status} | Cash: $${Number(account.cash).toLocaleString()} | Portfolio: $${Number(account.portfolio_value).toLocaleString()}`)

  // 2. Market Clock
  console.log('\n2. Market Clock...')
  const clock = await alpaca.getClock()
  console.log(`   ✓ Market is: ${clock.is_open ? 'OPEN 🟢' : 'CLOSED 🔴'}`)
  console.log(`   ✓ Next open:  ${new Date(clock.next_open).toLocaleString()}`)
  console.log(`   ✓ Next close: ${new Date(clock.next_close).toLocaleString()}`)

  // 3. Portfolio History
  console.log('\n3. Portfolio History (1M)...')
  const history = await alpaca.getPortfolioHistory({ period: '1M', timeframe: '1D' })
  console.log(`   ✓ ${history.timestamp.length} data points | Base value: $${history.base_value}`)

  // 4. Stock Price via Snapshot
  console.log('\n4. Stock Price (AAPL)...')
  const snap = await alpaca.getSnapshot('AAPL')
  const bar = snap.DailyBar
  const prev = snap.PrevDailyBar
  const changePct = ((bar.ClosePrice - prev.ClosePrice) / prev.ClosePrice * 100).toFixed(2)
  console.log(`   ✓ AAPL: $${bar.ClosePrice} (${changePct}% vs prev close $${prev.ClosePrice})`)

  // 5. Top Movers
  console.log('\n5. Top Movers...')
  const snaps = await alpaca.getSnapshots(['AAPL','MSFT','NVDA','AMZN','TSLA','AMD','META','NFLX','INTC','COIN'])
  const stocks = snaps
    .filter(s => s.DailyBar && s.PrevDailyBar)
    .map(s => ({ symbol: s.symbol, pct: ((s.DailyBar.ClosePrice - s.PrevDailyBar.ClosePrice) / s.PrevDailyBar.ClosePrice * 100).toFixed(2) }))
    .sort((a, b) => b.pct - a.pct)
  console.log(`   ✓ Top gainer: ${stocks[0]?.symbol} (${stocks[0]?.pct}%)`)
  console.log(`   ✓ Top loser:  ${stocks[stocks.length - 1]?.symbol} (${stocks[stocks.length - 1]?.pct}%)`)

  // 6. Crypto Prices (via getBarsV2 — crypto symbols work on stock endpoint)
  console.log('\n6. Crypto Prices...')
  for (const sym of ['BTCUSD', 'ETHUSD', 'SOLUSD']) {
    const bars = alpaca.getBarsV2(sym, { timeframe: '1Day', limit: 1 })
    for await (const b of bars) {
      console.log(`   ✓ ${sym}: $${b.ClosePrice.toLocaleString()}`)
    }
  }

  // 7. News
  console.log('\n7. Market News...')
  const news = await alpaca.getNews({ limit: 3, sort: 'desc' })
  news.forEach(n => console.log(`   ✓ [${n.Source}] ${n.Headline.slice(0, 70)}`))

  // 8. Watchlists
  console.log('\n8. Watchlists...')
  const watchlists = await alpaca.getWatchlists()
  console.log(`   ✓ ${watchlists.length} watchlist(s) found`)

  // 9. Account Activity
  console.log('\n9. Account Activity...')
  const activity = await alpaca.getAccountActivities({ activity_type: 'FILL', page_size: 5 })
  console.log(`   ✓ ${activity.length} recent trade fill(s)`)

  console.log('\n── All tests passed! ✓ ──\n')
}

test().catch(err => {
  console.error('\n✗ Test failed:', err.message)
  process.exit(1)
})
