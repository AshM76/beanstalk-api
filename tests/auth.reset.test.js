/**
 * Password-reset flow tests (in-memory store).
 *
 * Runs with BEANSTALK_ENVIRONMENT=test so user.service is backed by the
 * in-memory store and no BigQuery/SMTP credentials are needed. In this mode the
 * forgot endpoint returns the code as `dev_code` (email isn't configured), so
 * the test can drive the full request/verify/reset cycle.
 */

process.env.BEANSTALK_ENVIRONMENT = 'test'
// createToken() signs with this (a Fly secret in prod); set a dummy so
// register/login/reset can mint JWTs under test.
process.env.BEANSTALK_KEY_TOKEN = process.env.BEANSTALK_KEY_TOKEN || 'test-signing-secret'

const request = require('supertest')
const express = require('express')

// Mount just the auth router rather than the full src/app.js: the whole app
// eagerly wires Firebase/Alpaca/etc. at require time, which needs credentials
// this focused test shouldn't depend on. The auth router → controller →
// user.service (in-memory) chain is all this suite exercises.
const app = express()
app.use(express.json())
app.use('/api', require('../src/routes/api/auth.route'))

function uniqueEmail() {
  return `reset-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

async function registerUser(email, password) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Reset Tester', email, password })
  expect(res.status).toBe(201)
  return res.body
}

describe('POST /api/auth/password/forgot', () => {
  test('returns a dev_code for a registered account (demo email fallback)', async () => {
    const email = uniqueEmail()
    await registerUser(email, 'origpass1')

    const res = await request(app).post('/api/auth/password/forgot').send({ email })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/reset code/i)
    expect(res.body.dev_code).toMatch(/^\d{6}$/)
  })

  test('does not reveal whether an unknown email exists (no dev_code)', async () => {
    const res = await request(app)
      .post('/api/auth/password/forgot')
      .send({ email: uniqueEmail() })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/reset code/i)
    expect(res.body.dev_code).toBeUndefined()
  })

  test('400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/password/forgot').send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/password/reset', () => {
  test('resets the password with a valid code and the old password stops working', async () => {
    const email = uniqueEmail()
    await registerUser(email, 'origpass1')

    const forgot = await request(app).post('/api/auth/password/forgot').send({ email })
    const code = forgot.body.dev_code

    const reset = await request(app)
      .post('/api/auth/password/reset')
      .send({ email, code, password: 'newpass2' })
    expect(reset.status).toBe(200)
    expect(reset.body.token).toBeTruthy()
    expect(reset.body.email).toBe(email.toLowerCase())

    // Old password rejected, new password accepted.
    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: 'origpass1' })
    expect(oldLogin.status).toBe(401)

    const newLogin = await request(app).post('/api/auth/login').send({ email, password: 'newpass2' })
    expect(newLogin.status).toBe(200)
    expect(newLogin.body.token).toBeTruthy()
  })

  test('rejects a wrong code', async () => {
    const email = uniqueEmail()
    await registerUser(email, 'origpass1')
    await request(app).post('/api/auth/password/forgot').send({ email })

    const res = await request(app)
      .post('/api/auth/password/reset')
      .send({ email, code: '000000', password: 'newpass2' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid or expired/i)
  })

  test('a used code cannot be reused', async () => {
    const email = uniqueEmail()
    await registerUser(email, 'origpass1')
    const forgot = await request(app).post('/api/auth/password/forgot').send({ email })
    const code = forgot.body.dev_code

    const first = await request(app)
      .post('/api/auth/password/reset')
      .send({ email, code, password: 'newpass2' })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/api/auth/password/reset')
      .send({ email, code, password: 'newpass3' })
    expect(second.status).toBe(400)
  })

  test('rejects a too-short new password', async () => {
    const email = uniqueEmail()
    await registerUser(email, 'origpass1')
    const forgot = await request(app).post('/api/auth/password/forgot').send({ email })

    const res = await request(app)
      .post('/api/auth/password/reset')
      .send({ email, code: forgot.body.dev_code, password: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least 6/i)
  })

  test('locks out after too many wrong attempts', async () => {
    const email = uniqueEmail()
    await registerUser(email, 'origpass1')
    await request(app).post('/api/auth/password/forgot').send({ email })

    // MAX_ATTEMPTS = 5 wrong tries, then the 6th is a lockout (429).
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/auth/password/reset')
        .send({ email, code: '000000', password: 'newpass2' })
      expect(r.status).toBe(400)
    }
    const locked = await request(app)
      .post('/api/auth/password/reset')
      .send({ email, code: '000000', password: 'newpass2' })
    expect(locked.status).toBe(429)
  })

  test('400 when required fields are missing', async () => {
    const res = await request(app).post('/api/auth/password/reset').send({ email: uniqueEmail() })
    expect(res.status).toBe(400)
  })

  test('a suspended account cannot regain a session via reset (even with a valid code)', async () => {
    const email = uniqueEmail()
    await registerUser(email, 'origpass1')

    // Reach into the store and suspend the account (there's no API to do this
    // in demo mode; the raw user object is the live record).
    const mem = require('../src/services/_memory_store').users
    mem.getUserByEmail(email).account_status = 'suspended'

    const forgot = await request(app).post('/api/auth/password/forgot').send({ email })
    const reset = await request(app)
      .post('/api/auth/password/reset')
      .send({ email, code: forgot.body.dev_code, password: 'newpass2' })
    expect(reset.status).toBe(403)

    // Password was not changed — the original still works.
    const login = await request(app).post('/api/auth/login').send({ email, password: 'origpass1' })
    expect(login.status).toBe(200)
  })
})
