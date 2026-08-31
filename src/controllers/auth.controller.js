/**
 * Auth controller.
 *
 * register / login / me / forgotPassword / resetPassword — all routed through
 * user.service, which picks BigQuery or the in-memory store based on
 * BEANSTALK_ENVIRONMENT.
 */

const bcrypt = require('bcryptjs')
const { createToken } = require('../services')
const userService = require('../services/user.service')
const { generateResetCode, CODE_TTL_MS, MAX_ATTEMPTS } = require('../utils/passwordReset')
const { sendPasswordResetEmail } = require('../utils/resetEmail')

const SALT_ROUNDS = 10

// In demo/test the mailer has no SMTP credentials, so the reset code can't be
// delivered by email. Only in those environments do we return it in the API
// response so the flow is usable — never in production.
const IS_DEMO_ENV = ['test', 'demo'].includes(process.env.BEANSTALK_ENVIRONMENT)

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS)

    let user
    try {
      user = await userService.createUser(name, email, hash)
    } catch (err) {
      if (err.code === 'EMAIL_EXISTS') {
        return res.status(409).json({ error: err.message })
      }
      throw err
    }

    const token = createToken(user.user_id)

    res.status(201).json({
      token,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    })
  } catch (error) {
    console.error('[auth/register]', error.message)
    res.status(500).json({ error: 'Registration failed' })
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, password' })
    }

    // getUserByEmail returns the auth shape including password_hash.
    const user = await userService.getUserByEmail(email)
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Fire-and-forget audit write; await to keep the flow linear but errors
    // are swallowed inside recordLogin so login still succeeds if BQ blips.
    await userService.recordLogin(user.user_id)

    const token = createToken(user.user_id)

    res.json({
      token,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    })
  } catch (error) {
    console.error('[auth/login]', error.message)
    res.status(500).json({ error: 'Login failed' })
  }
}

// GET /api/auth/me  (requires auth middleware)
async function me(req, res) {
  try {
    const userId = req.user && req.user.user_id ? req.user.user_id : req.user
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await userService.getUserById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  } catch (error) {
    console.error('[auth/me]', error.message)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
}

// POST /api/auth/password/forgot
// Body: { email }. Always returns 200 with a generic message so the endpoint
// can't be used to probe which emails are registered.
async function forgotPassword(req, res) {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email' })
    }

    const generic = {
      message: 'If an account exists for that email, a reset code has been sent.',
    }

    const user = await userService.getUserByEmail(email)
    if (!user) return res.json(generic)

    const code = generateResetCode()
    const codeHash = await bcrypt.hash(code, SALT_ROUNDS)
    const expiresAt = new Date(Date.now() + CODE_TTL_MS)
    await userService.setPasswordReset(user.user_id, codeHash, expiresAt)

    // Best-effort email — never blocks or fails the request. Resolves false if
    // the mailer isn't configured (e.g. demo env without SMTP creds).
    const emailed = await sendPasswordResetEmail(user.email, code).catch(() => false)

    // Demo/test convenience ONLY: when we couldn't email the code, hand it back
    // in the response so the reset flow is usable without SMTP.
    if (IS_DEMO_ENV && !emailed) {
      return res.json({
        ...generic,
        dev_code: code,
        dev_note:
          'Email delivery is not configured in this environment; code returned for demo use only.',
      })
    }

    // Prod without a working mailer: the request looks successful but the user
    // will never get the code. Log loudly so the misconfiguration is visible
    // (we still don't leak the code in the response outside demo).
    if (!emailed) {
      console.error(
        '[auth/forgotPassword] reset code generated but NOT delivered ' +
          '(mailer not configured); user_id=' + user.user_id,
      )
    }

    return res.json(generic)
  } catch (error) {
    console.error('[auth/forgotPassword]', error.message)
    res.status(500).json({ error: 'Could not process password reset request' })
  }
}

// POST /api/auth/password/reset
// Body: { email, code, password }. Verifies the code (hash + expiry + attempt
// cap) and sets a new password. Failure messages are intentionally uniform so
// they don't reveal which part was wrong.
async function resetPassword(req, res) {
  try {
    const { email, code, password } = req.body
    if (!email || !code || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, code, password' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const user = await userService.getResetState(email)
    const invalid = () => res.status(400).json({ error: 'Invalid or expired reset code' })

    if (!user || !user.reset_code_hash || !user.reset_expires_at) return invalid()

    const expires =
      user.reset_expires_at instanceof Date
        ? user.reset_expires_at
        : new Date(user.reset_expires_at)
    if (Number.isNaN(expires.getTime()) || expires.getTime() < Date.now()) {
      await userService.clearPasswordReset(user.user_id)
      return invalid()
    }

    if ((user.reset_attempts || 0) >= MAX_ATTEMPTS) {
      await userService.clearPasswordReset(user.user_id)
      return res.status(429).json({ error: 'Too many attempts. Request a new reset code.' })
    }

    const ok = await bcrypt.compare(String(code), user.reset_code_hash)
    if (!ok) {
      await userService.incrementResetAttempts(user.user_id)
      return invalid()
    }

    // Only reachable with a valid code (so this doesn't leak status to anyone
    // probing), but a suspended/deleted account must not regain a session via
    // reset. Consume the code so it can't be retried.
    if (user.account_status && user.account_status !== 'active') {
      await userService.clearPasswordReset(user.user_id)
      return res.status(403).json({ error: 'This account is not active. Contact support.' })
    }

    const newHash = await bcrypt.hash(password, SALT_ROUNDS)
    await userService.updatePassword(user.user_id, newHash)

    // Issue a fresh token so the app can drop straight into a signed-in state,
    // mirroring the register/login responses.
    const token = createToken(user.user_id)
    res.json({
      token,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      message: 'Password updated',
    })
  } catch (error) {
    console.error('[auth/resetPassword]', error.message)
    res.status(500).json({ error: 'Could not reset password' })
  }
}

module.exports = { register, login, me, forgotPassword, resetPassword }
