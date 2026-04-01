/**
 * Age Verification Controller
 * Handles age verification endpoints (self-reported, ID verification, parental consent)
 */

const AgeVerificationService = require('../services/age_verification.service')
const ParentalConsentService = require('../services/parental_consent.service')

/**
 * POST /api/onboarding/age-verify/self-report
 * Self-reported age verification
 */
async function verifySelfReported(req, res) {
  try {
    const { date_of_birth } = req.body
    const userId = req.user.user_id

    if (!date_of_birth) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'date_of_birth is required'
      })
    }

    // Validate date of birth format (YYYY-MM-DD)
    const dobValidation = AgeVerificationService.validateDateOfBirth(date_of_birth)
    if (!dobValidation.valid) {
      return res.status(400).json({
        error: 'INVALID_DATE_OF_BIRTH',
        message: dobValidation.error
      })
    }

    // Verify the user's age
    const result = await AgeVerificationService.verifySelfReported(date_of_birth)

    // TODO: Update user record in BigQuery
    // await BigQuery.updateUserAgeVerification(userId, {
    //   user_dateOfBirth: date_of_birth,
    //   user_age_verified: true,
    //   user_age_verification_method: 'self_reported',
    //   user_age_verification_timestamp: new Date(),
    //   user_age_group: result.age_group
    // })

    return res.status(200).json({
      verified: true,
      age_group: result.age_group,
      age_verification_method: 'self_reported',
      age_verification_timestamp: result.age_verification_timestamp,
      message: `Successfully verified as ${result.age_group}`
    })
  } catch (err) {
    return res.status(400).json({
      error: 'AGE_VERIFICATION_FAILED',
      message: err.message
    })
  }
}

/**
 * POST /api/onboarding/age-verify/id-verification/init
 * Initialize ID verification flow with third-party provider
 */
async function initIdVerification(req, res) {
  try {
    const { id_verification_provider = 'id_me' } = req.body
    const userId = req.user.user_id

    const result = await AgeVerificationService.initIdVerification(userId, id_verification_provider)

    // TODO: Store verification session in database
    // await BigQuery.createVerificationSession({
    //   verification_session_id: result.verification_session_id,
    //   user_id: userId,
    //   provider: id_verification_provider,
    //   created_at: new Date(),
    //   expires_at: result.expires_at
    // })

    return res.status(200).json({
      verification_session_id: result.verification_session_id,
      redirect_url: result.redirect_url,
      expires_at: result.expires_at,
      message: 'ID verification session created. Redirect user to complete verification.'
    })
  } catch (err) {
    return res.status(400).json({
      error: 'ID_VERIFICATION_INIT_FAILED',
      message: err.message
    })
  }
}

/**
 * POST /api/onboarding/age-verify/id-verification/callback
 * Process ID verification callback from third-party provider
 * This endpoint should be called by the ID verification provider's webhook
 */
async function completeIdVerification(req, res) {
  try {
    const { user_id, verification_result } = req.body

    if (!user_id || !verification_result) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'user_id and verification_result are required'
      })
    }

    const result = await AgeVerificationService.completeIdVerification(user_id, verification_result)

    // TODO: Update user record in BigQuery
    // await BigQuery.updateUserAgeVerification(user_id, {
    //   user_dateOfBirth: verification_result.date_of_birth,
    //   user_age_verified: true,
    //   user_age_verification_method: 'id_verification',
    //   user_age_verification_timestamp: new Date(),
    //   user_age_group: result.age_group
    // })

    return res.status(200).json({
      verified: true,
      age_group: result.age_group,
      age_verification_method: 'id_verification',
      message: 'Age verification completed via ID verification'
    })
  } catch (err) {
    return res.status(400).json({
      error: 'ID_VERIFICATION_FAILED',
      message: err.message
    })
  }
}

module.exports = {
  verifySelfReported,
  initIdVerification,
  completeIdVerification
}
