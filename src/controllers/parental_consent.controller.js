/**
 * Parental Consent Controller
 * Handles parental consent workflow for users under 18
 */

const ParentalConsentService = require('../services/parental_consent.service')

/**
 * POST /api/onboarding/parental-consent/init
 * Initialize parental consent process for users under 18
 */
async function initParentalConsent(req, res) {
  try {
    const {
      minor_name,
      minor_email,
      parent_name,
      parent_email,
      minor_date_of_birth
    } = req.body

    const userId = req.user.user_id

    // Validate required fields
    const missingFields = []
    if (!minor_name) missingFields.push('minor_name')
    if (!parent_email) missingFields.push('parent_email')
    if (!minor_date_of_birth) missingFields.push('minor_date_of_birth')

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: `Missing required fields: ${missingFields.join(', ')}`
      })
    }

    const result = await ParentalConsentService.initParentalConsent(userId, {
      minorName: minor_name,
      minorEmail: minor_email,
      parentName: parent_name,
      parentEmail: parent_email,
      minorDateOfBirth: minor_date_of_birth
    })

    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({
      error: 'PARENTAL_CONSENT_INIT_FAILED',
      message: err.message
    })
  }
}

/**
 * POST /api/onboarding/parental-consent/verify
 * Verify parent consent via verification token
 * Token is provided in URL query param from email link
 */
async function verifyParentConsent(req, res) {
  try {
    const { verification_token } = req.body

    if (!verification_token) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'verification_token is required'
      })
    }

    const result = await ParentalConsentService.verifyParentConsent(verification_token)

    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({
      error: 'PARENTAL_CONSENT_VERIFICATION_FAILED',
      message: err.message
    })
  }
}

/**
 * POST /api/onboarding/parental-consent/resend
 * Resend parental consent verification email to parent
 */
async function resendParentConsentEmail(req, res) {
  try {
    const userId = req.user.user_id

    const result = await ParentalConsentService.resendParentConsentEmail(userId)

    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({
      error: 'RESEND_FAILED',
      message: err.message
    })
  }
}

/**
 * POST /api/onboarding/parental-consent/decline
 * User declines parental consent (cancels consent request)
 */
async function declineParentalConsent(req, res) {
  try {
    const userId = req.user.user_id

    const result = await ParentalConsentService.declineParentalConsent(userId)

    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({
      error: 'DECLINE_FAILED',
      message: err.message
    })
  }
}

/**
 * GET /api/onboarding/parental-consent/status
 * Get current parental consent status for user
 */
async function getParentalConsentStatus(req, res) {
  try {
    const userId = req.user.user_id

    const status = await ParentalConsentService.getParentalConsentStatus(userId)

    return res.status(200).json(status)
  } catch (err) {
    return res.status(400).json({
      error: 'STATUS_FETCH_FAILED',
      message: err.message
    })
  }
}

module.exports = {
  initParentalConsent,
  verifyParentConsent,
  resendParentConsentEmail,
  declineParentalConsent,
  getParentalConsentStatus
}
