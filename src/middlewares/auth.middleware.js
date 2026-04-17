const services = require('../services')

function isAuth (req,res,next) {
    // Dev/test bypass: allow unauthenticated requests through when the server
    // is running in test mode (no login flow on the client yet). The userId
    // from the URL (:userId param) or body is trusted as the acting user so
    // downstream controllers' `req.user.user_id === userId` checks pass.
    if (['test', 'demo'].includes(process.env.BEANSTALK_ENVIRONMENT)) {
        // If the client sent a real JWT (e.g. mobile app after login), decode
        // it so req.user.user_id reflects the authenticated user rather than
        // a URL-scraped fallback. Fall through to the legacy bypass only when
        // no Authorization header is present (backward-compatible with curl).
        if (req.headers.authorization) {
            const token = req.headers.authorization.split(' ')[1]
            if (token) {
                return services.decodeToken(token)
                    .then(userId => {
                        req.user = { user_id: userId, role: 'admin', _devBypass: false }
                        next()
                    })
                    .catch(() => {
                        // Token invalid/expired — fall through to bypass
                        req.user = { user_id: null, role: 'admin', _devBypass: true }
                        next()
                    })
            }
        }

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