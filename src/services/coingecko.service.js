const https = require('https')

// ── Simple in-memory cache — refreshed every 24 hours ─────────
let cache = { coins: [], updatedAt: null }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const fetchTop20 = () => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.coingecko.com',
            path: '/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1',
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        }
        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => { data += chunk })
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data))
                } catch (e) {
                    reject(new Error('Failed to parse CoinGecko response'))
                }
            })
        })
        req.on('error', reject)
        req.end()
    })
}

const getTop20 = async () => {
    const now = Date.now()
    if (cache.updatedAt && (now - cache.updatedAt) < CACHE_TTL_MS) {
        return cache.coins
    }
    try {
        const coins = await fetchTop20()
        cache = { coins, updatedAt: now }
        return coins
    } catch (error) {
        // Return stale cache if refresh fails rather than breaking trades
        if (cache.coins.length > 0) return cache.coins
        throw new Error(`CoinGecko unavailable: ${error.message}`)
    }
}

// ── Check if a crypto symbol is in the top 20 ────────────────
// symbol: 'BTC' | 'ETH' | 'SOL' etc.
const isCryptoEligible = async (symbol) => {
    try {
        const coins = await getTop20()
        const sym = symbol.replace('/USD', '').replace('USD', '').toUpperCase()
        return coins.some(c => c.symbol.toUpperCase() === sym)
    } catch (error) {
        // Fail open on CoinGecko outage — don't block trades
        console.warn(`CoinGecko check failed for ${symbol}, failing open:`, error.message)
        return true
    }
}

// ── Get top-20 list with ranks (for UI display) ───────────────
const getTop20WithRanks = async () => {
    const coins = await getTop20()
    return coins.map((c, i) => ({
        rank: i + 1,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        price: c.current_price,
        market_cap: c.market_cap,
        change_24h: c.price_change_percentage_24h,
        image: c.image,
    }))
}

module.exports = { isCryptoEligible, getTop20WithRanks }
