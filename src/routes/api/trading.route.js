const { Router } = require('express')
const router = Router()

const tradingCtrl = require('../../controllers/api/trading/trading.controller')

// ── Account ───────────────────────────────────────────────────
router.get('/trading/account', tradingCtrl.getAccount)                          // balance & status
router.get('/trading/account/history', tradingCtrl.getAccountHistory)           // equity chart data (?period=1M&timeframe=1D)
router.get('/trading/account/activity', tradingCtrl.getAccountActivity)         // trade fill history

// ── Market ────────────────────────────────────────────────────
router.get('/trading/clock', tradingCtrl.getMarketClock)                        // is market open/closed + next open/close
router.get('/trading/movers', tradingCtrl.getTopMovers)                         // top gainers & losers today
router.get('/trading/news', tradingCtrl.getNews)                                // general market news
router.get('/trading/news/:symbol', tradingCtrl.getNews)                        // news for a specific symbol

// ── Stocks ────────────────────────────────────────────────────
router.get('/trading/portfolio', tradingCtrl.getPortfolio)                      // current positions
router.get('/trading/price/:symbol', tradingCtrl.getStockPrice)                 // stock price (e.g. AAPL)
router.get('/trading/orders', tradingCtrl.getOrders)                            // order history
router.post('/trading/order', tradingCtrl.placeOrder)                           // place buy/sell stock order

// ── Crypto ────────────────────────────────────────────────────
router.get('/trading/crypto/prices', tradingCtrl.getCryptoPrices)               // all major coins
router.get('/trading/crypto/price/:symbol', tradingCtrl.getCryptoPrice)         // single coin (e.g. BTCUSD)
router.post('/trading/crypto/order', tradingCtrl.placeCryptoOrder)              // place buy/sell crypto order

// ── Watchlists ────────────────────────────────────────────────
router.get('/trading/watchlists', tradingCtrl.getWatchlists)                    // all watchlists
router.post('/trading/watchlist', tradingCtrl.createWatchlist)                  // create watchlist
router.post('/trading/watchlist/:id/add', tradingCtrl.addToWatchlist)           // add symbol to watchlist
router.delete('/trading/watchlist/:id/remove/:symbol', tradingCtrl.removeFromWatchlist) // remove symbol
router.delete('/trading/watchlist/:id', tradingCtrl.deleteWatchlist)            // delete watchlist

module.exports = router
