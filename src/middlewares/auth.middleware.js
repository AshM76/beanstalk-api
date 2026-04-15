const services = require('../services')

function isAuth (req,res,next) {
    // Dev/test bypass: allow unauthenticated requests through when the server
    // is running in test mode (no login flow on the client yet). The userId
    // from the URL (:userId param) or body is trusted as the acting user so
    // downstream controllers' `req.user.user_id === userId` checks pass.
    if (process.env.BEANSTALK_ENVIRONMENT === 'test') {
        // Params aren't populated yet when this runs as upstream middleware
        // (market.route.js applies router.use(auth) which fires for every
        // /api/* request before the matching router extracts :userId). Parse
        // the likely userId segment out of the raw URL as a fallback.
        const pathMatch = req.path.match(/\/(?:portfolio|contests?)\/([^/?]+)/)
        const fallbackUserId =
            req.params.userId ||
            req.params.userid ||
            (req.body && req.body.userId) ||
            (req.body && req.body.user_id) ||
            (pathMatch && pathMatch[1]) ||
            null
        // Default to 'admin' role in test mode so admin-only endpoints
        // (create/conclude contests, view participants) work without real
        // RBAC wiring. Clients that need to exercise the user-level path can
        // set ?role=user explicitly.
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