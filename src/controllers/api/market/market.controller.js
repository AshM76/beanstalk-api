const { getPrice, getPrices, searchAssets, getBars, getMarketClock } = require('../../../services/alpaca.service')
const { isAssetAllowed, filterAssets } = require('../../../services/assetFilter.service')
const { isCryptoEligible, getTop20WithRanks } = require('../../../services/coingecko.service')
const { getChallengeRules } = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_contests')

// ── Safe defaults used when no challenge_id is provided or lookup fails ──
const DEFAULT_RULES = { crypto_allowed: false }

// ── GET /api/market/search?q=apple&challenge_id=xxx ───────────
const searchMarket = async (req, res) => {
    try {
        const { q, challenge_id } = req.query

        if (!q || q.length < 1) {
            return res.status(400).json({ ok: false, message: 'Query param q is required' })
        }

        // Load challenge rules from BigQuery when a challenge_id is supplied
        let challengeRules = DEFAULT_RULES
        if (challenge_id) {
            const result = await getChallengeRules(challenge_id)
            if (!result.error) {
                challengeRules = result.data
            }
        }

        const raw = await searchAssets(q)
        const filtered = await filterAssets(raw, challengeRules)

        return res.json({ ok: true, results: filtered })

    } catch (error) {
        console.error('[market/search]', error.message)
        return res.status(500).json({ ok: false, message: error.message })
    }
}

// ── GET /api/market/price/:symbol ─────────────────────────────
const getSymbolPrice = async (req, res) => {
    try {
        const { symbol } = req.params
        const data = await getPrice(symbol.toUpperCase())
        return res.json({ ok: true, ...data })
    } catch (error) {
        console.error('[market/price]', error.message)
        return res.status(404).json({ ok: false, message: error.message })
    }
}

// ── POST /api/market/prices  body: { symbols: ['AAPL','NVDA'] }
const getBatchPrices = async (req, res) => {
    try {
        const { symbols } = req.body
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({ ok: false, message: 'symbols array required' })
        }
        if (symbols.length > 50) {
            return res.status(400).json({ ok: false, message: 'Max 50 symbols per batch' })
        }
        const data = await getPrices(symbols.map(s => s.toUpperCase()))
        return res.json({ ok: true, prices: data })
    } catch (error) {
        console.error('[market/prices]', error.message)
        return res.status(500).json({ ok: false, message: error.message })
    }
}

// ── GET /api/market/bars/:symbol?timeframe=1Day&limit=30 ──────
const getSymbolBars = async (req, res) => {
    try {
        const { symbol } = req.params
        const { timeframe = '1Day', limit = 30 } = req.query

        const validTimeframes = ['1Min', '5Min', '15Min', '1Hour', '1Day']
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({ ok: false, message: `timeframe must be one of: ${validTimeframes.join(', ')}` })
        }

        const bars = await getBars(symbol.toUpperCase(), timeframe, parseInt(limit))
        return res.json({ ok: true, symbol: symbol.toUpperCase(), timeframe, bars })
    } catch (error) {
        console.error('[market/bars]', error.message)
        return res.status(500).json({ ok: false, message: error.message })
    }
}

// ── GET /api/market/asset/:symbol/check?challenge_id=xxx ──────
// Validates whether a symbol is tradeable in a given challenge
const checkAsset = async (req, res) => {
    try {
        const { symbol } = req.params
        const { challenge_id } = req.query

        // Load challenge rules from BigQuery when a challenge_id is supplied
        let challengeRules = DEFAULT_RULES
        if (challenge_id) {
            const result = await getChallengeRules(challenge_id)
            if (!result.error) {
                challengeRules = result.data
            }
        }

        const result = await isAssetAllowed(symbol.toUpperCase(), challengeRules)

        // Extra crypto top-20 check
        if (result.allowed && result.asset_class === 'CRYPTO') {
            const eligible = await isCryptoEligible(symbol)
            if (!eligible) {
                return res.json({ ok: true, allowed: false, reason: 'Crypto not in top 20 by market cap' })
            }
        }

        return res.json({ ok: true, ...result })
    } catch (error) {
        console.error('[market/check]', error.message)
        return res.status(500).json({ ok: false, message: error.message })
    }
}

// ── GET /api/market/clock ─────────────────────────────────────
const marketClock = async (req, res) => {
    try {
        const clock = await getMarketClock()
        return res.json({
            ok: true,
            is_open: clock.is_open,
            next_open: clock.next_open,
            next_close: clock.next_close,
            timestamp: clock.timestamp,
        })
    } catch (error) {
        console.error('[market/clock]', error.message)
        return res.status(500).json({ ok: false, message: error.message })
    }
}

// ── GET /api/market/crypto/top20 ─────────────────────────────
const getCryptoTop20 = async (req, res) => {
    try {
        const coins = await getTop20WithRanks()
        return res.json({ ok: true, coins })
    } catch (error) {
        console.error('[market/crypto/top20]', error.message)
        return res.status(500).json({ ok: false, message: error.message })
    }
}

module.exports = {
    searchMarket,
    getSymbolPrice,
    getBatchPrices,
    getSymbolBars,
    checkAsset,
    marketClock,
    getCryptoTop20,
}
