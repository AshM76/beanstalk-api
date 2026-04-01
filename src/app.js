const express = require('express')
const cors = require('cors')

const app = express()

// ── Settings ──────────────────────────────────────────────────
const { BEANSTALK_SERVER_PORT } = process.env
app.set('port', process.env.PORT || BEANSTALK_SERVER_PORT || 8080)

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors())

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

// ── Routes: shared ────────────────────────────────────────────
app.use('/api', require('./routes/api/roles.route'))
app.use('/api', require('./routes/api/chat.route'))
app.use('/api', require('./routes/api/deals.route'))         // rewards
app.use('/api', require('./routes/api/inventory.route'))     // content library
app.use('/api', require('./routes/api/cloudstorage.route'))
app.use('/api', require('./routes/api/trading.route'))          // Alpaca paper trading
app.use('/api', require('./routes/api/onboarding.route'))     // age verification & parental consent
app.use('/api', require('./routes/api/compliance.route'))     // EULA & consent management

module.exports = app
