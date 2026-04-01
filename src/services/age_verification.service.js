const jwt = require('jsonwebtoken')
const { sendEmail } = require('../../services') // Reuse existing email service

/**
 * Age Verification Service
 * Handles three age verification methods:
 * 1. Self-reported (user enters DOB)
 * 2. ID verification (third-party integration)
 * 3. Parental consent (for users under 18)
 */

class AgeVerificationService {
  /**
   * Calculate age from date of birth
   * @param {Date|string} dateOfBirth - Date of birth in YYYY-MM-DD format
   * @returns {number} Age in years
   */
  static calculateAge(dateOfBirth) {
    const birth = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  /**
   * Determine age group based on date of birth
   * Age groups: middle_school (13-14), high_school (15-18), college (19-25), adults (26+)
   * @param {Date|string} dateOfBirth - Date of birth
   * @returns {string|null} Age group or null if too young
   */
  static getAgeGroup(dateOfBirth) {
    const age = this.calculateAge(dateOfBirth)

    if (age < 13) return null // Too young for platform

    if (age < 15) return 'middle_school' // 13-14
    if (age < 19) return 'high_school'   // 15-18
    if (age < 26) return 'college'       // 19-25
    return 'adults'                       // 26+
  }

  /**
   * Validate date of birth format and value
   * @param {string} dateOfBirth - DOB in YYYY-MM-DD format
   * @returns {object} { valid: boolean, error?: string }
   */
  static validateDateOfBirth(dateOfBirth) {
    // Check format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateOfBirth)) {
      return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD.' }
    }

    const dob = new Date(dateOfBirth)

    // Invalid date
    if (isNaN(dob.getTime())) {
      return { valid: false, error: 'Invalid date of birth.' }
    }

    // Future date
    if (dob > new Date()) {
      return { valid: false, error: 'Date of birth cannot be in the future.' }
    }

    const age = this.calculateAge(dateOfBirth)

    // Too young
    if (age < 13) {
      return { valid: false, error: 'You must be at least 13 years old to use this platform.' }
    }

    // Too old (data validation)
    if (age > 120) {
      return { valid: false, error: 'Invalid date of birth.' }
    }

    return { valid: true }
  }

  /**
   * Method 1: Self-reported age verification
   * User enters their DOB and we verify if they're old enough
   * @param {string} dateOfBirth - DOB in YYYY-MM-DD format
   * @returns {object} { verified: boolean, age_group: string, timestamp: Date }
   */
  static async verifySelfReported(dateOfBirth) {
    const dobValidation = this.validateDateOfBirth(dateOfBirth)
    if (!dobValidation.valid) {
      throw new Error(dobValidation.error)
    }

    const ageGroup = this.getAgeGroup(dateOfBirth)
    if (!ageGroup) {
      throw new Error('User is too young for this platform.')
    }

    return {
      verified: true,
      age_group: ageGroup,
      age_verification_method: 'self_reported',
      age_verification_timestamp: new Date(),
    }
  }

  /**
   * Method 2: ID Verification - Initialize
   * Start ID verification flow with third-party provider (e.g., ID.me, Socure)
   * @param {string} userId - User ID
   * @param {string} idVerificationProvider - Provider (id_me, socure, etc.)
   * @returns {object} { verification_session_id, redirect_url, expires_at }
   */
  static async initIdVerification(userId, idVerificationProvider = 'id_me') {
    // Generate unique session ID
    const verificationSessionId = `verify_${userId}_${Date.now()}`

    // TODO: Integrate with actual ID verification provider
    // This is a placeholder for the third-party integration
    const redirectUrl = `https://id-verification-provider.example.com/verify?session=${verificationSessionId}&return_url=${process.env.API_BASE_URL}/api/onboarding/age-verify/id-verification/callback`

    return {
      verification_session_id: verificationSessionId,
      redirect_url: redirectUrl,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour expiry
    }
  }

  /**
   * Method 2: ID Verification - Complete
   * Process callback from ID verification provider
   * @param {string} userId - User ID
   * @param {object} verificationResult - Result from provider
   * @returns {object} { verified: boolean, age_group: string }
   */
  static async completeIdVerification(userId, verificationResult) {
    // Validate provider signature (implement based on provider)
    // For now, assume verificationResult is validated

    if (!verificationResult.verified) {
      throw new Error('Age verification failed. Please try again.')
    }

    // Extract DOB from verification result
    const dateOfBirth = verificationResult.date_of_birth
    const dobValidation = this.validateDateOfBirth(dateOfBirth)

    if (!dobValidation.valid) {
      throw new Error('Age verification failed. You may be too young for this platform.')
    }

    const ageGroup = this.getAgeGroup(dateOfBirth)
    if (!ageGroup) {
      throw new Error('You must be at least 13 years old to use this platform.')
    }

    return {
      verified: true,
      age_group: ageGroup,
      age_verification_method: 'id_verification',
      age_verification_timestamp: new Date(),
      verified_name: verificationResult.name, // For records
    }
  }

  /**
   * Method 3: Parental Consent - Initialize
   * Start parental consent workflow for users under 18
   * @param {string} userId - User ID
   * @param {string} parentEmail - Parent/guardian email
   * @param {string} minorName - Child's name
   * @returns {object} { consent_pending_id, verification_token_sent }
   */
  static async initParentalConsent(userId, parentEmail, minorName) {
    // Generate parent verification token (JWT, 7-day expiry)
    const parentVerificationToken = jwt.sign(
      { userId, parentEmail, action: 'parental_consent' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    const consentPendingId = `consent_${userId}_${Date.now()}`
    const verificationUrl = `${process.env.APP_BASE_URL}/parental-consent/verify?token=${parentVerificationToken}`

    // Send email to parent
    await sendEmail({
      to: parentEmail,
      subject: `Please verify consent for ${minorName}'s account on Beanstalk`,
      template: 'parental_consent',
      variables: {
        parentName: parentEmail.split('@')[0], // Placeholder
        minorName,
        verificationUrl,
        expiryDays: 7,
      }
    })

    return {
      consent_pending_id: consentPendingId,
      verification_token_sent_to: parentEmail,
      verification_url: verificationUrl,
      expires_in_days: 7,
    }
  }

  /**
   * Method 3: Parental Consent - Verify
   * Verify parent consent through token
   * @param {string} token - Parent verification JWT token
   * @returns {object} { verified: boolean, userId: string }
   */
  static async verifyParentConsent(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      if (decoded.action !== 'parental_consent') {
        throw new Error('Invalid token type.')
      }

      return {
        verified: true,
        userId: decoded.userId,
        parentEmail: decoded.parentEmail,
        consent_verified_at: new Date(),
        age_verified_method: 'parental_consent',
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new Error('Verification link has expired. Please request a new one.')
      }
      throw new Error('Invalid verification token.')
    }
  }

  /**
   * Generate new parent verification token (for resend)
   * @param {string} userId - User ID
   * @param {string} parentEmail - Parent email
   * @returns {object} { token, expiresAt }
   */
  static generateParentVerificationToken(userId, parentEmail) {
    const token = jwt.sign(
      { userId, parentEmail, action: 'parental_consent' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return {
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }
  }

  /**
   * Check if age verification is required
   * @param {number} age - User's age
   * @returns {object} { requiresVerification: boolean, method: string }
   */
  static getRequiredVerificationMethod(age) {
    if (age < 13) {
      return { requiresVerification: false, reason: 'Too young for platform' }
    }

    if (age < 18) {
      return {
        requiresVerification: true,
        methods: ['parental_consent'],
        reason: 'Parental consent required for users under 18'
      }
    }

    return {
      requiresVerification: true,
      methods: ['self_reported', 'id_verification'],
      reason: 'Age verification required'
    }
  }
}

module.exports = AgeVerificationService
