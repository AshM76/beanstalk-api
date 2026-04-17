/**
 * User Service
 * Handles user account CRUD: register, authenticate, fetch profile.
 *
 * Persistence: Google BigQuery.
 *   Table (see migrations/007_add_users_table.sql):
 *     - `${dataset}.users`  (one row per account)
 *
 * Mirrors the pattern used by contest.service.js and portfolio.service.js:
 *   - Named parameter queries throughout
 *   - DATETIME fields serialized via toBqDatetime / unwrapDatetime
 *   - Email stored lowercased; uniqueness enforced at service layer
 *   - In test/demo mode, swaps to the in-memory store at module.exports time
 */

const { v4: uuidv4 } = require('uuid')
const { BigQuery } = require('@google-cloud/bigquery')

const {
  BEANSTALK_GCP_BIGQUERY_PROJECTID,
  BEANSTALK_GCP_BIGQUERY_DATASETID,
} = process.env

const keyFilename = './src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json'
const bigquery = new BigQuery({
  projectId: BEANSTALK_GCP_BIGQUERY_PROJECTID,
  keyFilename,
})

const DATASET = BEANSTALK_GCP_BIGQUERY_DATASETID
const USERS_TABLE = `\`${BEANSTALK_GCP_BIGQUERY_PROJECTID}.${DATASET}.users\``

// ── BQ value helpers ──────────────────────────────────────────────────────
function toBqDatetime(value) {
  if (value === null || value === undefined) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace('T', ' ').replace('Z', '')
}

function unwrapDatetime(v) {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object' && v.value) return new Date(v.value.replace(' ', 'T') + 'Z')
  return new Date(v)
}

// Public shape — never includes password_hash.
function rowToPublicUser(row) {
  if (!row) return null
  return {
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    avatar_url: row.avatar_url || null,
    role: row.role || 'user',
    age_group: row.age_group || null,
    account_status: row.account_status || 'active',
    email_verified: Boolean(row.email_verified),
    created_at: unwrapDatetime(row.created_at),
  }
}

// Full shape — includes password_hash; only used by login/auth paths.
function rowToAuthUser(row) {
  if (!row) return null
  return {
    ...rowToPublicUser(row),
    password_hash: row.password_hash,
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────

/**
 * Create a new user. Throws if the email is already registered.
 *
 * @param {string} name
 * @param {string} email
 * @param {string} passwordHash  bcrypt hash (caller hashes, so the service
 *                               never sees plaintext)
 * @param {object} opts          { role?, age_group? }
 * @returns {Promise<object>}    public user (no password_hash)
 */
async function createUser(name, email, passwordHash, opts = {}) {
  const normalizedEmail = (email || '').toLowerCase().trim()

  if (!name || !normalizedEmail || !passwordHash) {
    throw new Error('name, email, and passwordHash are required')
  }

  // Uniqueness guard — BigQuery doesn't enforce unique constraints natively.
  const existing = await getUserByEmail(normalizedEmail)
  if (existing) {
    const err = new Error('An account with this email already exists')
    err.code = 'EMAIL_EXISTS'
    throw err
  }

  const now = new Date()
  const user = {
    user_id: uuidv4(),
    name,
    email: normalizedEmail,
    password_hash: passwordHash,
    avatar_url: null,
    role: opts.role || 'user',
    age_group: opts.age_group || null,
    date_of_birth: null,
    account_status: 'active',
    email_verified: false,
    last_login_at: null,
    created_at: now,
    updated_at: now,
  }

  const query = `
    INSERT INTO ${USERS_TABLE}
      (user_id, name, email, password_hash, avatar_url, role, age_group,
       account_status, email_verified, created_at, updated_at)
    VALUES
      (@user_id, @name, @email, @password_hash, @avatar_url, @role, @age_group,
       @account_status, @email_verified, DATETIME(@created_at), DATETIME(@updated_at))
  `

  await bigquery.query({
    query,
    params: {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      password_hash: user.password_hash,
      avatar_url: user.avatar_url,
      role: user.role,
      age_group: user.age_group,
      account_status: user.account_status,
      email_verified: user.email_verified,
      created_at: toBqDatetime(user.created_at),
      updated_at: toBqDatetime(user.updated_at),
    },
    types: {
      avatar_url: 'STRING',
      age_group: 'STRING',
    },
  })

  return rowToPublicUser(user)
}

/**
 * Lookup by email. Returns the auth shape (with password_hash) because
 * the only caller is login flow. For profile reads use getUserById.
 */
async function getUserByEmail(email) {
  const normalized = (email || '').toLowerCase().trim()
  if (!normalized) return null

  const query = `
    SELECT user_id, name, email, password_hash, avatar_url, role, age_group,
           account_status, email_verified, created_at
      FROM ${USERS_TABLE}
     WHERE email = @email
     LIMIT 1
  `

  const [rows] = await bigquery.query({
    query,
    params: { email: normalized },
  })

  return rowToAuthUser(rows[0] || null)
}

/**
 * Lookup by user_id. Returns the public shape (no password_hash).
 */
async function getUserById(userId) {
  if (!userId) return null

  const query = `
    SELECT user_id, name, email, avatar_url, role, age_group,
           account_status, email_verified, created_at
      FROM ${USERS_TABLE}
     WHERE user_id = @user_id
     LIMIT 1
  `

  const [rows] = await bigquery.query({
    query,
    params: { user_id: userId },
  })

  return rowToPublicUser(rows[0] || null)
}

/**
 * Update last_login_at timestamp. Called after successful login for
 * analytics / security auditing. Errors are swallowed — login should
 * never fail because of a logging side-effect.
 */
async function recordLogin(userId) {
  try {
    const query = `
      UPDATE ${USERS_TABLE}
         SET last_login_at = DATETIME(@now),
             updated_at    = DATETIME(@now)
       WHERE user_id = @user_id
    `
    await bigquery.query({
      query,
      params: { user_id: userId, now: toBqDatetime(new Date()) },
    })
  } catch (err) {
    console.error('[user.service] recordLogin failed (non-fatal):', err.message)
  }
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  recordLogin,
}

// Dev/test bypass: when running without GCP credentials, back the service
// with the in-memory store so the mobile app can be exercised end-to-end.
// The memory store already exposes createUser/getUserByEmail/getUserById on
// the `users` namespace — add an async `recordLogin` shim to match the
// BigQuery interface (callers await recordLogin).
if (['test', 'demo'].includes(process.env.BEANSTALK_ENVIRONMENT)) {
  const mem = require('./_memory_store').users
  module.exports = {
    createUser: async (name, email, passwordHash, opts = {}) => {
      const existing = mem.getUserByEmail(email)
      if (existing) {
        const err = new Error('An account with this email already exists')
        err.code = 'EMAIL_EXISTS'
        throw err
      }
      return mem.createUser(name, email, passwordHash, opts)
    },
    getUserByEmail: async (email) => mem.getUserByEmail(email),
    getUserById: async (userId) => mem.getUserById(userId),
    recordLogin: async () => {},
  }
  console.log('[Beanstalk] :: user.service → in-memory store (test mode)')
}
