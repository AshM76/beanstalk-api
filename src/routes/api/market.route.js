const express = require('express')
const router = express.Router()
const auth = require('../../middlewares/auth.middleware')
const {
    searchMarket,
    getSymbolPrice,
    getBatchPrices,
    getSymbolBars,
    checkAsset,
    marketClock,
    getCryptoTop20,
} = require('../controllers/api/market/market.controller')

// All market routes require a valid JWT
router.use(auth)

// ── Search ────────────────────────────────────────────────────
// GET /api/market/search?q=apple
router.get('/market/search', searchMarket)

// ── Prices ────────────────────────────────────────────────────
// GET  /api/market/price/AAPL
router.get('/market/price/:symbol', getSymbolPrice)

// POST /api/market/prices  { symbols: ['AAPL', 'NVDA', 'BTC'] }
router.post('/market/prices', getBatchPrices)

// ── Chart data ────────────────────────────────────────────────
// GET /api/market/bars/AAPL?timeframe=1Day&limit=30
router.get('/market/bars/:symbol', getSymbolBars)

// ── Asset eligibility ─────────────────────────────────────────
// GET /api/market/asset/NVDA/check?challenge_id=xxx
router.get('/market/asset/:symbol/check', checkAsset)

// ── Market status ─────────────────────────────────────────────
// GET /api/market/clock
router.get('/market/clock', marketClock)

// ── Crypto top 20 ─────────────────────────────────────────────
// GET /api/market/crypto/top20
router.get('/market/crypto/top20', getCryptoTop20)

module.exports = router
