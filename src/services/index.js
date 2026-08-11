const jwt = require('jwt-simple')
const moment = require('moment')

const { BEANSTALK_KEY_TOKEN } = process.env

function createToken(userId) {

    const payload = {
        sub: userId,
        iat: moment().unix(),
        // 30-day TTL: long enough that beta testers rarely hit a mid-session
        // expiry. The client auto-routes to login on 401 if one does expire.
        // Only affects newly issued tokens; there's no per-token revocation
        // (rotating BEANSTALK_KEY_TOKEN invalidates all tokens at once).
        exp: moment().add(30, 'days').unix(),
    }

    return jwt.encode(payload, BEANSTALK_KEY_TOKEN)
}

function decodeToken(token) {
    const decoded = new Promise((resolve, reject) => {
        try {
            const payload = jwt.decode(token, BEANSTALK_KEY_TOKEN)

            if (payload.exp <= moment().unix()) {
                reject({
                    status: 401,
                    message: 'The token has expired'
                })
            }
            resolve(payload.sub)

        } catch (error) {
            reject({
                status: 500,
                message: 'Invalid token'
            })
        }
    })
    return decoded
}

module.exports = {
    createToken,
    decodeToken
}