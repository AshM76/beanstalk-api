/**
 * Auth controller for test/in-memory mode.
 *
 * Provides register, login, and profile endpoints that mirror the
 * production BigQuery-backed flow but store users in the in-memory
 * store so the mobile app can exercise a real auth flow without GCP.
 */

const bcrypt = require('bcryptjs')
const { createToken } = require('../services')
const store = require('../services/_memory_store')

const SALT_ROUNDS = 10

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

    // Check duplicate
    const existing = store.users.getUserByEmail(email)
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    const user = store.users.createUser(name, email, hash)
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

    // getUserByEmail returns the full record (including password_hash)
    const user = store.users.getUserByEmail(email)
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

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

    const user = store.users.getUserById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  } catch (error) {
    console.error('[auth/me]', error.message)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
}

module.exports = { register, login, me }
