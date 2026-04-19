const { getAsset } = require('./alpaca.service')

// ── Local-dev asset class map ─────────────────────────────────
// Used by classifyAsset when BEANSTALK_USE_ALPACA !== 'true' so the
// backend can classify symbols without a live Alpaca dependency during
// local development. Kept intentionally small — only the symbols we
// actually exercise in dev. Unknown symbols return null (same fail-open
// semantics as the Alpaca path).
const LOCAL_ASSET_CLASS_MAP = {
    // Stocks
    AAPL:  'STOCK',
    MSFT:  'STOCK',
    GOOGL: 'STOCK',
    TSLA:  'STOCK',
    NVDA:  'STOCK',
    AMZN:  'STOCK',
    META:  'STOCK',
    COIN:  'STOCK',
    // ETFs
    SPY:   'ETF',
    QQQ:   'ETF',
    VTI:   'ETF',
    VOO:   'ETF',
    XLF:   'ETF',
    XLK:   'ETF',
    // Crypto
    BTC:   'CRYPTO',
    ETH:   'CRYPTO',
    XRP:   'CRYPTO',
    SOL:   'CRYPTO',
}

// ── Allowed exchanges ─────────────────────────────────────────
const ALLOWED_EXCHANGES = ['NYSE', 'NASDAQ', 'AMEX', 'ARCA', 'BATS']

// ── Approved mutual fund providers (ticker prefix matching) ───
const FUND_PROVIDERS = {
    FIDELITY:   ['F'],           // FXAIX, FSKAX, FTBFX etc.
    VANGUARD:   ['V'],           // VFIAX, VTSAX, VBTLX etc.
    BLACKROCK:  ['BLK', 'BL'],   // BLKRK funds
    SCHWAB:     ['SW', 'SCH'],   // SWPPX, SWTSX etc.
}

// ── Leveraged / inverse ETF keyword detection ─────────────────
const LEVERAGED_KEYWORDS = [
    '2x', '3x', '2X', '3X',
    'ultra', 'Ultra',
    'leveraged', 'Leveraged',
    'inverse', 'Inverse',
    'short', 'Short',
    'bear', 'Bear',
    'bull 2', 'bull 3',
    'proshares ultra',
    'direxion',
]

const isLeveragedOrInverse = (asset) => {
    const name = (asset.name || '').toLowerCase()
    return LEVERAGED_KEYWORDS.some(kw => name.includes(kw.toLowerCase()))
}

// ── Main filter — call before any trade or search result ──────
// challengeRules: { crypto_allowed, crypto_trading_hours }
const isAssetAllowed = async (symbol, challengeRules = {}) => {
    try {
        const asset = await getAsset(symbol)

        // Must be actively tradable
        if (!asset.tradable || asset.status !== 'active') {
            return { allowed: false, reason: 'Asset is not currently tradable' }
        }

        // ── Crypto ────────────────────────────────────────────
        if ((asset.asset_class || asset.class) === 'crypto') {
            if (!challengeRules.crypto_allowed) {
                return { allowed: false, reason: 'Crypto not allowed in this challenge' }
            }
            // Top-20 enforcement handled separately via CoinGecko cache
            return { allowed: true, asset_class: 'CRYPTO' }
        }

        // ── US Equities ───────────────────────────────────────
        if ((asset.asset_class || asset.class) === 'us_equity') {
            // Exchange check
            if (!ALLOWED_EXCHANGES.includes(asset.exchange)) {
                return { allowed: false, reason: `Exchange ${asset.exchange} not supported` }
            }

            // Block OTC / pink sheets
            if (asset.exchange === 'OTC' || asset.fractionable === false && asset.marginable === false) {
                return { allowed: false, reason: 'OTC and pink sheet stocks not allowed' }
            }

            // ETF leveraged/inverse check
            if (isLeveragedOrInverse(asset)) {
                return { allowed: false, reason: 'Leveraged and inverse ETFs not allowed' }
            }

            // Determine sub-type
            const name = (asset.name || '').toLowerCase()
            const isETF = name.includes('etf') || name.includes('fund') || name.includes('trust')

            if (isETF) {
                return { allowed: true, asset_class: 'ETF' }
            }

            return { allowed: true, asset_class: 'STOCK' }
        }

        return { allowed: false, reason: 'Asset class not supported' }

    } catch (error) {
        return { allowed: false, reason: error.message }
    }
}

// ── Pure classifier — no rule enforcement ─────────────────────
// Returns 'STOCK' | 'ETF' | 'CRYPTO' | null.
// Used at buy-time to tag a new position with its asset class. Does NOT
// enforce tradability / exchange / leverage rules — those are already
// checked by isAssetAllowed earlier in the trade flow. Returns null on
// any failure so classification can never block a trade that was
// otherwise authorized; the read path (mobile) defaults missing values
// to Stock so null is safe.
const classifyAsset = async (symbol) => {
    // Local-dev mode: skip the Alpaca round-trip and use the hardcoded
    // map. Gated on BEANSTALK_USE_ALPACA !== 'true' so CI / prod must
    // opt in explicitly.
    if (process.env.BEANSTALK_USE_ALPACA !== 'true') {
        const mapped = LOCAL_ASSET_CLASS_MAP[symbol]
        if (mapped) return mapped
        console.log('[classifyAsset] local-map miss', { symbol })
        return null
    }

    try {
        const asset = await getAsset(symbol)
        const cls = asset.asset_class || asset.class

        if (cls === 'crypto') return 'CRYPTO'

        if (cls === 'us_equity') {
            const name = (asset.name || '').toLowerCase()
            const isETF = name.includes('etf') || name.includes('fund') || name.includes('trust')
            return isETF ? 'ETF' : 'STOCK'
        }

        return null
    } catch (error) {
        // Structured so outage-nulls (Alpaca down / timeout / 5xx) can be
        // told apart from bug-nulls (unknown asset_class, schema drift).
        console.error('[classifyAsset] failed', {
            symbol,
            error: error.message,
            code: error.code || error.statusCode || null,
            status: error.response?.status || null,
            timestamp: new Date().toISOString(),
        })
        return null
    }
}

// ── Filter a batch of search results ─────────────────────────
const filterAssets = async (assets, challengeRules = {}) => {
    const results = await Promise.all(
        assets.map(async (asset) => {
            const check = await isAssetAllowed(asset.symbol, challengeRules)
            return check.allowed ? { ...asset, asset_class: check.asset_class } : null
        })
    )
    return results.filter(Boolean)
}

module.exports = { isAssetAllowed, classifyAsset, filterAssets, isLeveragedOrInverse }
