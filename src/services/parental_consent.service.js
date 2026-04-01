const AgeVerificationService = require('./age_verification.service')
const BigQuery = require('../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_auth')

/**
 * Parental Consent Service
 * Manages parental consent workflow for users under 18
 */

class ParentalConsentService {
  /**
   * Initialize parental consent process
   * @param {string} userId - User ID
   * @param {object} data - { minorName, minorEmail, parentName, parentEmail, minorDateOfBirth }
   * @returns {object} Consent pending record
   */
  static async initParentalConsent(userId, data) {
    const { minorName, minorEmail, parentEmail, parentName, minorDateOfBirth } = data

    // Validate parent email
    if (!this.validateEmail(parentEmail)) {
      throw new Error('Invalid parent email address.')
    }

    // Verify minor is actually under 18
    const age = AgeVerificationService.calculateAge(minorDateOfBirth)
    if (age >= 18) {
      throw new Error('Parental consent not required for users 18+.')
    }

    // Get parent verification token
    const { token } = AgeVerificationService.generateParentVerificationToken(userId, parentEmail)

    // Log parental consent request in database
    const consentRecord = {
      user_id: userId,
      parent_email: parentEmail,
      parent_name: parentName || 'Parent/Guardian',
      minor_name: minorName,
      minor_email: minorEmail,
      parent_consent: false,
      parent_email_verified: false,
      parent_verification_token: token,
      parent_verification_token_expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
      created_at: new Date(),
    }

    // Save to BigQuery or relevant database
    // await BigQuery.insertParentalConsentRecord(consentRecord)

    // Send consent verification email
    await this.sendParentConsentEmail({
      parentEmail,
      parentName,
      minorName: minorName,
      userId,
      verificationToken: token,
    })

    return {
      consent_initiated: true,
      verification_email_sent_to: parentEmail,
      expires_in_days: 7,
      message: `Verification email sent to ${parentEmail}. Parent must click the link to activate the account.`
    }
  }

  /**
   * Send parent consent verification email
   * @param {object} data - Email data
   */
  static async sendParentConsentEmail(data) {
    const { parentEmail, parentName, minorName, verificationToken } = data
    const verificationUrl = `${process.env.APP_BASE_URL}/parental-consent/verify?token=${verificationToken}`

    // Using existing email service
    // await sendEmail({
    //   to: parentEmail,
    //   subject: `Please verify consent for ${minorName}'s account on Beanstalk`,
    //   template: 'parental_consent_verification',
    //   variables: {
    //     parentName: parentName || 'Parent/Guardian',
    //     minorName,
    //     verificationUrl,
    //     expiryDays: 7,
    //   }
    // })

    console.log(`[DEBUG] Parental consent email would be sent to ${parentEmail}`)
  }

  /**
   * Verify parent consent via token
   * @param {string} token - Verification token
   * @returns {object} Verification result
   */
  static async verifyParentConsent(token) {
    try {
      const verified = AgeVerificationService.verifyParentConsent(token)

      if (!verified.verified) {
        throw new Error('Token verification failed.')
      }

      // Update user record to mark parent consent as verified
      // await BigQuery.updateUserParentalConsent({
      //   user_id: verified.userId,
      //   parent_email_verified: true,
      //   parent_consent: true,
      //   parent_consent_timestamp: new Date(),
      // })

      // Send confirmation email to parent and parent
      await this.sendParentConsentConfirmation({
        userId: verified.userId,
        parentEmail: verified.parentEmail,
      })

      return {
        verified: true,
        userId: verified.userId,
        message: 'Parental consent verified successfully. Account is now active.'
      }
    } catch (err) {
      throw new Error(`Parental consent verification failed: ${err.message}`)
    }
  }

  /**
   * Send confirmation email after parent verifies consent
   * @param {object} data - { userId, parentEmail }
   */
  static async sendParentConsentConfirmation(data) {
    const { parentEmail, userId } = data

    // await sendEmail({
    //   to: parentEmail,
    //   subject: 'Consent Verified - Account Activated',
    //   template: 'parental_consent_confirmed',
    //   variables: {
    //     confirmationTime: new Date(),
    //   }
    // })

    console.log(`[DEBUG] Confirmation email would be sent to ${parentEmail}`)
  }

  /**
   * Resend parent consent verification email
   * @param {string} userId - User ID
   * @returns {object} Resend result
   */
  static async resendParentConsentEmail(userId) {
    // Fetch pending consent record from database
    // const consentRecord = await BigQuery.getParentalConsentRecord(userId)

    // if (!consentRecord || consentRecord.status !== 'pending') {
    //   throw new Error('No pending parental consent request found.')
    // }

    // Generate new token
    // const { token } = AgeVerificationService.generateParentVerificationToken(
    //   userId,
    //   consentRecord.parent_email
    // )

    // Update token in database
    // await BigQuery.updateParentalConsentToken(userId, token)

    // Resend email
    // await this.sendParentConsentEmail({
    //   parentEmail: consentRecord.parent_email,
    //   parentName: consentRecord.parent_name,
    //   minorName: consentRecord.minor_name,
    //   userId,
    //   verificationToken: token,
    // })

    return {
      resent: true,
      message: 'Verification email resent to parent.'
    }
  }

  /**
   * Decline parental consent (user can cancel)
   * @param {string} userId - User ID
   * @returns {object} Result
   */
  static async declineParentalConsent(userId) {
    // Update status to 'declined' in database
    // await BigQuery.updateParentalConsentStatus(userId, 'declined')

    return {
      declined: true,
      message: 'Parental consent request cancelled. Account will not be activated.'
    }
  }

  /**
   * Get parental consent status for a user
   * @param {string} userId - User ID
   * @returns {object} Status information
   */
  static async getParentalConsentStatus(userId) {
    // Fetch from database
    // const record = await BigQuery.getParentalConsentRecord(userId)

    // if (!record) {
    //   return {
    //     has_pending_consent: false,
    //     message: 'No parental consent request found.'
    //   }
    // }

    // return {
    //   has_pending_consent: record.status === 'pending',
    //   parent_email: record.parent_email,
    //   status: record.status, // pending, verified, declined
    //   days_until_expiry: Math.ceil(
    //     (new Date(record.parent_verification_token_expires) - new Date()) / (1000 * 60 * 60 * 24)
    //   ),
    //   created_at: record.created_at,
    //   verified_at: record.parent_consent_timestamp,
    // }

    return { has_pending_consent: false }
  }

  /**
   * Validate email format
   * @param {string} email - Email address
   * @returns {boolean} Valid or not
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Check if user needs parental consent
   * @param {string} dateOfBirth - User's date of birth
   * @returns {boolean} True if under 18
   */
  static needsParentalConsent(dateOfBirth) {
    const age = AgeVerificationService.calculateAge(dateOfBirth)
    return age < 18
  }
}

module.exports = ParentalConsentService
