const services = require('../services')
const userService = require('../services/user.service')

// In test/demo mode, authenticated users are role 'user' by default so the
// per-owner checks in the portfolio/contest controllers actually isolate one
// tester from another. Admin privileges (create/conclude contests, cross-user
// reads) are granted only to this allowlist — which must include the demo
// seed's admin account so seeding can create contests. Override via
// BEANSTALK_ADMIN_EMAILS (comma-separated).
const ADMIN_EMAILS = (process.env.BEANSTALK_ADMIN_EMAILS || 'admin@beanstalk.app')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

async function resolveDemoRole(userId) {
    try {
        const u = await userService.getUserById(userId)
        if (u && u.email && ADMIN_EMAILS.includes(u.email.toLowerCase())) return 'admin'
    } catch (_) {
        // Lookup failed — fall through to least-privilege.
    }
    return 'user'
}

function isAuth (req,res,next) {
    // The legacy unauthenticated bypass is OFF by default. It only engages
    // when BEANSTALK_AUTH_BYPASS=true, so test/demo mode enforces real
    // signup/login by default. The in-memory store, mock trade fills, and
    // demo seeding are gated separately on BEANSTALK_ENVIRONMENT and are NOT
    // affected by this flag — flipping it changes auth behaviour only.
    const bypassEnabled = process.env.BEANSTALK_AUTH_BYPASS === 'true'

    if (['test', 'demo'].includes(process.env.BEANSTALK_ENVIRONMENT)) {
        // Honor a real JWT when the client sends one (mobile app after login)
        // so req.user.user_id reflects the authenticated user.
        if (req.headers.authorization) {
            const token = req.headers.authorization.split(' ')[1]
            if (token) {
                return services.decodeToken(token)
                    .then(async userId => {
                        const role = await resolveDemoRole(userId)
                        req.user = { user_id: userId, role, _devBypass: false }
                        next()
                    })
                    .catch(() => {
                        // Token invalid/expired. Fall through to the bypass only
                        // when it's explicitly enabled; otherwise reject.
                        if (bypassEnabled) {
                            req.user = { user_id: null, role: 'admin', _devBypass: true }
                            return next()
                        }
                        return res.status(401).send({ message: 'Token unauthorized' })
                    })
            }
        }

        if (bypassEnabled) {
            // Legacy bypass: scrape userId from URL/body for unauthenticated calls
            const pathMatch = req.path.match(/\/(?:portfolio|contests?)\/([^/?]+)/)
            const fallbackUserId =
                req.params.userId ||
                req.params.userid ||
                (req.body && req.body.userId) ||
                (req.body && req.body.user_id) ||
                (pathMatch && pathMatch[1]) ||
                null
            const role = req.query.role === 'user' ? 'user' : 'admin'
            req.user = { user_id: fallbackUserId, role, _devBypass: true }
            return next()
        }

        // Auth enforced (default): no usable token → reject.
        return res.status(401).send({ message: 'Authentication required' })
    }

    if (!req.headers.authorization) {
        return res.status(403).send({ message: 'Not have authorization'})
    }

    const token = req.headers.authorization.split(" ")[1]
    services.decodeToken(token)
        .then (response => {
            req.user = response
            next()
        })
        .catch (response => {
            res.status(401).send({ message: 'Token unauthorized'})
        })
}

module.exports = isAuth
