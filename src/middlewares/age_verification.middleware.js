/**
 * Age Verification Middleware
 * Validates user age verification status and enforces age-based restrictions
 */

/**
 * Check if user has completed age verification
 * Required for contest participation and age-restricted features
 */
function requireAgeVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  if (!req.user.user_age_verified) {
    return res.status(403).json({
      error: 'AGE_NOT_VERIFIED',
      message: 'Must complete age verification to access this resource',
      next_step: '/onboarding/age-verify'
    })
  }

  next()
}

/**
 * Check if user's age group is in the allowed list
 * Used for age-specific contests and features
 * @param {array} allowedGroups - Array of allowed age groups (e.g., ['high_school', 'college'])
 */
function requireAgeGroup(allowedGroups) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' })
    }

    if (!req.user.user_age_group) {
      return res.status(403).json({
        error: 'AGE_GROUP_NOT_DETERMINED',
        message: 'Age group could not be determined. Please complete age verification.'
      })
    }

    if (!allowedGroups.includes(req.user.user_age_group)) {
      return res.status(403).json({
        error: 'AGE_GROUP_NOT_ELIGIBLE',
        message: `This resource is for ${allowedGroups.join(', ')} users only`,
        user_age_group: req.user.user_age_group
      })
    }

    next()
  }
}

/**
 * Check if user has accepted all required consent types
 * Validates against user_consents array for specific document types
 * @param {array} requiredConsentTypes - EULA types required (e.g., ['terms_of_service', 'privacy_policy'])
 */
function requireConsents(requiredConsentTypes) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' })
    }

    // Get user's accepted consents
    const userConsents = req.user.user_consents || []
    const acceptedTypes = userConsents
      .filter(c => c.consent_accepted === true)
      .map(c => c.consent_type)

    // Find missing consents
    const missingSome = requiredConsentTypes.filter(type => !acceptedTypes.includes(type))

    if (missingSome.length > 0) {
      return res.status(403).json({
        error: 'CONSENTS_REQUIRED',
        message: 'Must accept all required agreements to continue',
        missing_consents: missingSome
      })
    }

    next()
  }
}

/**
 * Enforce parental consent requirement for minors (users under 18)
 * Blocks account features until parent email is verified
 */
function restrictIfMinor(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  // Check if user is in a minor age group
  const isMinor = req.user.user_age_group === 'middle_school' || req.user.user_age_group === 'high_school'

  if (isMinor) {
    // For minors, parental consent must be verified
    if (!req.user.user_parent_email_verified) {
      return res.status(403).json({
        error: 'PARENTAL_CONSENT_REQUIRED',
        message: 'Account requires parental verification. Parent email verification is pending.',
        parent_email: req.user.user_parent_email
      })
    }

    // Check if parent consent is actually accepted
    if (!req.user.user_parent_consent) {
      return res.status(403).json({
        error: 'PARENTAL_CONSENT_PENDING',
        message: 'Parent has not yet accepted the consent agreement.'
      })
    }
  }

  next()
}

module.exports = {
  requireAgeVerified,
  requireAgeGroup,
  requireConsents,
  restrictIfMinor
}
