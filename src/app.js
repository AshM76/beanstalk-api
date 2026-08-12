const express = require('express')
const cors = require('cors')

const app = express()

// ── Settings ──────────────────────────────────────────────────
const { BEANSTALK_SERVER_PORT } = process.env
app.set('port', process.env.PORT || BEANSTALK_SERVER_PORT || 8080)

app.use(express.urlencoded({ extended: true }))
// 1mb (default 100kb) so base64 logo uploads (≤512KB decoded ≈ 700KB encoded)
// fit through the JSON body parser.
app.use(express.json({ limit: '1mb' }))
app.use(cors())

// ── Health check ──────────────────────────────────────────────
// Dependency-free liveness probe used by Fly's [[http_service.checks]] (and
// any other uptime monitor). Must not touch BigQuery/Firebase so it returns
// 200 even when downstream services are cold or unconfigured.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: process.env.BEANSTALK_SERVER_VERSION || null,
    environment: process.env.BEANSTALK_ENVIRONMENT || null,
    uptime: process.uptime(),
  })
})

// ── Routes: index ─────────────────────────────────────────────
app.use(require('./routes/index.route'))

// ── Routes: mobile app ────────────────────────────────────────
app.use('/api', require('./routes/app/auth.route'))
app.use('/api', require('./routes/app/user.route'))
app.use('/api', require('./routes/app/session.route'))       // lesson sessions
app.use('/api', require('./routes/app/stores.route'))        // course providers
app.use('/api', require('./routes/app/notifications.route'))
app.use('/api', require('./routes/app/clinicians.route'))    // mentors
app.use('/api', require('./routes/app/demo.route'))

// ── Routes: web portal ────────────────────────────────────────
app.use('/api', require('./routes/web/auth.dispensary.route'))
app.use('/api', require('./routes/web/dispensaries.route'))  // course providers
app.use('/api', require('./routes/web/stores.route'))
app.use('/api', require('./routes/web/clinicians.route'))    // mentors

// ── Routes: auth (in-memory / test mode) ──────────────────────
app.use('/api', require('./routes/api/auth.route'))

// ── Routes: contest assets ────────────────────────────────────
// Must stay ABOVE the market router: market.route.js runs `router.use(auth)`
// for every /api/* request that reaches it, and GET /contest-assets/:id must
// remain public (mobile image widgets can't send Authorization headers).
app.use('/api', require('./routes/api/asset.route'))

// ── Routes: shared ────────────────────────────────────────────
app.use('/api', require('./routes/api/market.route'))        // Alpaca market data
app.use('/api', require('./routes/api/roles.route'))
app.use('/api', require('./routes/api/chat.route'))
app.use('/api', require('./routes/api/deals.route'))         // rewards
app.use('/api', require('./routes/api/inventory.route'))     // content library
app.use('/api', require('./routes/api/cloudstorage.route'))
app.use('/api', require('./routes/api/trading.route'))          // Alpaca paper trading
app.use('/api', require('./routes/api/onboarding.route'))     // age verification & parental consent
app.use('/api', require('./routes/api/compliance.route'))     // EULA & consent management
app.use('/api', require('./routes/api/portfolio.route'))      // portfolio & trading operations
app.use('/api', require('./routes/api/contest.route'))        // contests & leaderboards
app.use('/api/ai', require('./routes/ai'))                    // AI advisor (Cash)

module.exports = app
