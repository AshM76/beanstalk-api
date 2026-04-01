/**
 * Compliance Controller
 * Handles EULA/consent management and user demographics
 */

const EulaService = require('../services/eula.service')
const AgeVerificationService = require('../services/age_verification.service')

/**
 * GET /api/compliance/eula/:eulaType
 * Get current version of EULA by type
 */
async function getEulaByType(req, res) {
  try {
    const { eulaType } = req.params

    if (!eulaType) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'eulaType is required'
      })
    }

    const eula = await EulaService.getCurrentEula(eulaType)

    if (!eula) {
      return res.status(404).json({
        error: 'EULA_NOT_FOUND',
        message: `No EULA found for type: ${eulaType}`
      })
    }

    return res.status(200).json({
      eula_id: eula.eula_id,
      eula_type: eula.eula_type,
      version: eula.version,
      content_html: eula.content_html,
      effective_date: eula.effective_date,
      requires_acceptance: eula.requires_acceptance
    })
  } catch (err) {
    return res.status(500).json({
      error: 'EULA_FETCH_FAILED',
      message: err.message
    })
  }
}

/**
 * GET /api/compliance/eula/:eulaType/:version
 * Get specific version of EULA
 */
async function getEulaByVersion(req, res) {
  try {
    const { eulaType, version } = req.params

    if (!eulaType || !version) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'eulaType and version are required'
      })
    }

    const eula = await EulaService.getEulaVersion(eulaType, version)

    if (!eula) {
      return res.status(404).json({
        error: 'EULA_VERSION_NOT_FOUND',
        message: `No EULA found for type: ${eulaType}, version: ${version}`
      })
    }

    return res.status(200).json(eula)
  } catch (err) {
    return res.status(500).json({
      error: 'EULA_FETCH_FAILED',
      message: err.message
    })
  }
}

/**
 * POST /api/compliance/accept-eula
 * Record user acceptance of EULA
 */
async function acceptEula(req, res) {
  try {
    const { eula_id } = req.body
    const userId = req.user.user_id
    const ipAddress = req.ip || req.headers['x-forwarded-for']
    const userAgent = req.headers['user-agent']

    if (!eula_id) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'eula_id is required'
      })
    }

    const result = await EulaService.acceptEula(userId, eula_id, {
      ipAddress,
      userAgent,
      deviceFingerprint: req.body.device_fingerprint
    })

    // TODO: Update user_consents array in BigQuery
    // await BigQuery.updateUserConsent(userId, result)

    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({
      error: 'EULA_ACCEPTANCE_FAILED',
      message: err.message
    })
  }
}

/**
 * GET /api/compliance/user-consents
 * Get user's consent history
 */
async function getUserConsents(req, res) {
  try {
    const userId = req.user.user_id

    const consents = await EulaService.getUserConsents(userId)

    return res.status(200).json({
      user_id: userId,
      consents: consents || [],
      total: (consents || []).length
    })
  } catch (err) {
    return res.status(500).json({
      error: 'CONSENTS_FETCH_FAILED',
      message: err.message
    })
  }
}

/**
 * POST /api/compliance/check-required-consents
 * Check if user has accepted required EULA types
 */
async function checkRequiredConsents(req, res) {
  try {
    const { required_eula_types } = req.body
    const userId = req.user.user_id

    if (!Array.isArray(required_eula_types) || required_eula_types.length === 0) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'required_eula_types must be a non-empty array'
      })
    }

    const result = await EulaService.checkRequiredConsents(userId, required_eula_types)

    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({
      error: 'CONSENT_CHECK_FAILED',
      message: err.message
    })
  }
}

/**
 * PUT /api/user/demographics
 * Update user demographics information
 */
async function updateUserDemographics(req, res) {
  try {
    const userId = req.user.user_id
    const {
      education_level,
      income_bracket,
      primary_interest,
      risk_tolerance,
      city,
      state,
      country,
      zip_code
    } = req.body

    const demographics = {
      user_education_level: education_level,
      user_income_bracket: income_bracket,
      user_primary_interest: primary_interest,
      user_risk_tolerance: risk_tolerance,
      user_city: city,
      user_state: state,
      user_country: country,
      user_zipCode: zip_code
    }

    // TODO: Update user record in BigQuery
    // await BigQuery.updateUserDemographics(userId, demographics)

    return res.status(200).json({
      updated: true,
      demographics_updated_at: new Date(),
      message: 'Demographics updated successfully'
    })
  } catch (err) {
    return res.status(400).json({
      error: 'DEMOGRAPHICS_UPDATE_FAILED',
      message: err.message
    })
  }
}

/**
 * GET /api/admin/users/:userId/verification-status
 * Get user's verification status (admin only)
 */
async function getVerificationStatus(req, res) {
  try {
    const { userId } = req.params

    // TODO: Check admin permissions
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Unauthorized' })
    // }

    // TODO: Fetch from BigQuery
    // const user = await BigQuery.getUserById(userId)

    return res.status(200).json({
      user_id: userId,
      age_verified: true, // placeholder
      age_group: 'college', // placeholder
      parent_consent_status: null,
      consents_signed: [
        { type: 'terms_of_service', accepted: true, accepted_at: new Date() }
      ],
      account_status: 'active'
    })
  } catch (err) {
    return res.status(500).json({
      error: 'VERIFICATION_STATUS_FETCH_FAILED',
      message: err.message
    })
  }
}

/**
 * PUT /api/admin/users/:userId/account-status
 * Update user account status (admin only - suspend, ban, activate)
 */
async function updateAccountStatus(req, res) {
  try {
    const { userId } = req.params
    const { status, reason } = req.body

    if (!status) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'status is required'
      })
    }

    // TODO: Check admin permissions
    // TODO: Update user record in BigQuery
    // await BigQuery.updateUserAccountStatus(userId, {
    //   user_account_status: status,
    //   user_account_status_reason: reason
    // })

    return res.status(200).json({
      user_id: userId,
      status,
      updated_at: new Date(),
      message: `Account status updated to ${status}`
    })
  } catch (err) {
    return res.status(400).json({
      error: 'STATUS_UPDATE_FAILED',
      message: err.message
    })
  }
}

/**
 * GET /api/user/contest-eligibility
 * Check if user is eligible to participate in contests
 */
async function checkContestEligibility(req, res) {
  try {
    const user = req.user

    const eligibility = {
      eligible: false,
      age_group: user.user_age_group,
      age_verified: user.user_age_verified,
      required_consents_pending: [],
      parent_consent_pending: false,
      notes: []
    }

    // Check age verification
    if (!user.user_age_verified) {
      eligibility.notes.push('Age verification required')
    }

    // Check required consents
    const requiredConsents = ['terms_of_service', 'privacy_policy', 'contest_rules']
    const userConsents = user.user_consents || []
    const acceptedConsents = userConsents
      .filter(c => c.consent_accepted === true)
      .map(c => c.consent_type)

    const missingConsents = requiredConsents.filter(type => !acceptedConsents.includes(type))
    if (missingConsents.length > 0) {
      eligibility.required_consents_pending = missingConsents
      eligibility.notes.push(`Missing consents: ${missingConsents.join(', ')}`)
    }

    // Check parental consent for minors
    if (user.user_age_group === 'middle_school' || user.user_age_group === 'high_school') {
      if (!user.user_parent_email_verified || !user.user_parent_consent) {
        eligibility.parent_consent_pending = true
        eligibility.notes.push('Parental consent required')
      }
    }

    // User is eligible if all requirements met
    eligibility.eligible =
      eligibility.age_verified &&
      eligibility.required_consents_pending.length === 0 &&
      !eligibility.parent_consent_pending

    return res.status(200).json(eligibility)
  } catch (err) {
    return res.status(500).json({
      error: 'ELIGIBILITY_CHECK_FAILED',
      message: err.message
    })
  }
}

module.exports = {
  getEulaByType,
  getEulaByVersion,
  acceptEula,
  getUserConsents,
  checkRequiredConsents,
  updateUserDemographics,
  getVerificationStatus,
  updateAccountStatus,
  checkContestEligibility
}
