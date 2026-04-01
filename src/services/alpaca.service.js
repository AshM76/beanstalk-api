const Alpaca = require('@alpacahq/alpaca-trade-api')

const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_SECRET_KEY,
    paper: true,
    feed: 'iex',
})

// ── Current price for a single symbol ─────────────────────────
const getPrice = async (symbol) => {
    try {
        const bar = await alpaca.getLatestBar(symbol)
        return {
            symbol,
            price: bar.ClosePrice,
            timestamp: bar.Timestamp,
        }
    } catch (error) {
        throw new Error(`Price unavailable for ${symbol}: ${error.message}`)
    }
}

// ── Current prices for multiple symbols (batch) ───────────────
const getPrices = async (symbols) => {
    try {
        const bars = await alpaca.getLatestBars(symbols)
        return Object.entries(bars).map(([symbol, bar]) => ({
            symbol,
            price: bar.ClosePrice,
            timestamp: bar.Timestamp,
        }))
    } catch (error) {
        throw new Error(`Batch price fetch failed: ${error.message}`)
    }
}

// ── Asset metadata (exchange, asset_class, tradable flags) ────
const getAsset = async (symbol) => {
    try {
        return await alpaca.getAsset(symbol)
    } catch (error) {
        throw new Error(`Asset not found: ${symbol}`)
    }
}

// ── Search tradable assets by query string ────────────────────
const searchAssets = async (query) => {
    try {
        const assets = await alpaca.getAssets({ status: 'active' })
        const q = query.toUpperCase()
        return assets
            .filter(a =>
                a.tradable &&
                (a.symbol.includes(q) || a.name.toUpperCase().includes(q))
            )
            .slice(0, 20)
    } catch (error) {
        throw new Error(`Asset search failed: ${error.message}`)
    }
}

// ── Historical bars for sparklines / charts ───────────────────
// timeframe: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day'
const getBars = async (symbol, timeframe = '1Day', limit = 30) => {
    try {
        const bars = []
        const stream = alpaca.getBarsV2(symbol, {
            timeframe,
            limit,
            feed: 'iex',
        })
        for await (const bar of stream) {
            bars.push({
                t: bar.Timestamp,
                o: bar.OpenPrice,
                h: bar.HighPrice,
                l: bar.LowPrice,
                c: bar.ClosePrice,
                v: bar.Volume,
            })
        }
        return bars
    } catch (error) {
        throw new Error(`Bar data unavailable for ${symbol}: ${error.message}`)
    }
}

// ── Market clock (open/closed status) ────────────────────────
const getMarketClock = async () => {
    try {
        return await alpaca.getClock()
    } catch (error) {
        throw new Error(`Market clock unavailable: ${error.message}`)
    }
}

module.exports = {
    getPrice,
    getPrices,
    getAsset,
    searchAssets,
    getBars,
    getMarketClock,
}
