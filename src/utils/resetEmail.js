/**
 * Best-effort password-reset email sender.
 *
 * Mirrors the Gmail/nodemailer configuration used by validationEmail.js — kept
 * as a small separate transport rather than shared, to avoid touching that
 * working flow — but is deliberately fail-soft: if SMTP credentials aren't
 * configured (e.g. the demo env, which has BEANSTALK_ACCOUNT_EMAIL but no
 * BEANSTALK_ACCOUNT_PASS), it
 * returns false instead of throwing. The auth controller then falls back to
 * returning the code in the response (demo only). Wire up BEANSTALK_ACCOUNT_PASS
 * (a Gmail app password) and real emails start sending with no code change.
 */

const nodemailer = require('nodemailer')

const { BEANSTALK_ACCOUNT_EMAIL, BEANSTALK_ACCOUNT_PASS, BEANSTALK_HOST } = process.env

let _transporter = null
function transporter() {
  if (!BEANSTALK_ACCOUNT_EMAIL || !BEANSTALK_ACCOUNT_PASS) return null
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      host: BEANSTALK_HOST,
      auth: { user: BEANSTALK_ACCOUNT_EMAIL, pass: BEANSTALK_ACCOUNT_PASS },
    })
  }
  return _transporter
}

// Returns true if the code was handed to the SMTP transport, false if email is
// not configured or sending failed. Never throws — callers treat false as
// "fall back to another delivery path".
async function sendPasswordResetEmail(email, code) {
  const t = transporter()
  if (!t) return false
  try {
    await t.sendMail({
      from: BEANSTALK_ACCOUNT_EMAIL,
      to: email,
      subject: 'Beanstalk — Password Reset Code',
      text:
        `Your Beanstalk password reset code is ${code}. ` +
        `It expires in 15 minutes. If you didn't request this, you can ignore this email.`,
      html:
        `<p>Your Beanstalk password reset code is:</p>` +
        `<p style="font-size:24px;font-weight:bold;letter-spacing:3px">${code}</p>` +
        `<p>It expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>`,
    })
    return true
  } catch (err) {
    console.error('[resetEmail] send failed:', err.message)
    return false
  }
}

// Synchronous check of whether SMTP credentials are present, without building a
// transport or sending. Lets the caller decide the demo dev_code fallback and
// whether to fire an email, without awaiting the (variable-latency) send.
function isMailerConfigured() {
  return Boolean(BEANSTALK_ACCOUNT_EMAIL && BEANSTALK_ACCOUNT_PASS)
}

module.exports = { sendPasswordResetEmail, isMailerConfigured }
