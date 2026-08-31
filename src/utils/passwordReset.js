/**
 * Password-reset helpers shared by the auth controller.
 *
 * A reset code is a 6-digit number the user receives (by email, or in the
 * demo env directly in the API response) and types back. We never store the
 * code itself — only a bcrypt hash of it — and it carries a short TTL plus an
 * attempt cap so a leaked or brute-forced code is low value.
 */

const crypto = require('crypto')

const CODE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

// Cryptographically-random 6-digit code, zero-padded. crypto.randomInt avoids
// the modulo bias a naive Math.floor(Math.random() * 1e6) would introduce.
function generateResetCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

module.exports = { generateResetCode, CODE_TTL_MS, MAX_ATTEMPTS }
