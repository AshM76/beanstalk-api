const { getAsset } = require('./alpaca.service')

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
        if (asset.asset_class === 'crypto') {
            if (!challengeRules.crypto_allowed) {
                return { allowed: false, reason: 'Crypto not allowed in this challenge' }
            }
            // Top-20 enforcement handled separately via CoinGecko cache
            return { allowed: true, asset_class: 'CRYPTO' }
        }

        // ── US Equities ───────────────────────────────────────
        if (asset.asset_class === 'us_equity') {
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

module.exports = { isAssetAllowed, filterAssets, isLeveragedOrInverse }
