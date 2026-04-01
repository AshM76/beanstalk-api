/**
 * EULA Service
 * Manages version-controlled EULA documents, acceptance tracking, and compliance
 */

class EulaService {
  /**
   * Create a new EULA document
   * @param {object} data - EULA document data
   * @returns {object} Created EULA record
   */
  static async createEulaDocument(data) {
    const {
      eulaType,
      userTypesApplicable,
      ageGroupsApplicable,
      contentHtml,
      contentPlainText,
      changeSummary,
      createdByAdminId,
      requiresAcceptance = true,
    } = data

    // Parse or validate version string
    const version = data.version || this.getNextVersion(eulaType)
    const [majorVersion, minorVersion, patchVersion] = version.split('.').map(Number)

    // If other versions exist, mark them as superseded
    // This would happen in the database layer

    const eulaId = `eula_${eulaType}_${Date.now()}`

    const eulaDocument = {
      eula_id: eulaId,
      eula_type: eulaType,
      user_types_applicable: userTypesApplicable || ['all'],
      age_groups_applicable: ageGroupsApplicable || ['all'],

      version,
      major_version: majorVersion,
      minor_version: minorVersion,
      patch_version: patchVersion,

      content_html: contentHtml,
      content_plain_text: contentPlainText,

      effective_date: new Date(),
      superseded_date: null,
      is_current_version: true,
      requires_acceptance: requiresAcceptance,

      created_at: new Date(),
      created_by_admin_id: createdByAdminId,
      change_summary: changeSummary,
    }

    // Save to database
    // await BigQuery.insertEulaDocument(eulaDocument)

    return eulaDocument
  }

  /**
   * Get current version of EULA by type
   * @param {string} eulaType - EULA type (terms_of_service, privacy_policy, contest_rules)
   * @returns {object} Current EULA document
   */
  static async getCurrentEula(eulaType) {
    // Fetch from database where is_current_version = true
    // const eula = await BigQuery.getEulaDocument(eulaType, { current: true })

    // Return mock data for now
    return {
      eula_id: `eula_${eulaType}_current`,
      eula_type: eulaType,
      version: '1.0.0',
      content_html: `<h1>${eulaType}</h1><p>EULA content here...</p>`,
      effective_date: new Date('2024-01-01'),
      requires_acceptance: true,
    }
  }

  /**
   * Get specific EULA version
   * @param {string} eulaType - EULA type
   * @param {string} version - Version string (e.g., "1.0.0")
   * @returns {object} EULA document
   */
  static async getEulaVersion(eulaType, version) {
    // Fetch from database
    // const eula = await BigQuery.getEulaDocument(eulaType, { version })
    // return eula

    // Mock response
    return {
      eula_id: `eula_${eulaType}_${version}`,
      eula_type: eulaType,
      version,
      content_html: `<h1>${eulaType} v${version}</h1>`,
    }
  }

  /**
   * Get all EULA versions for a type
   * @param {string} eulaType - EULA type
   * @returns {array} All versions of EULA
   */
  static async getAllEulaVersions(eulaType) {
    // Fetch from database, ordered by version DESC
    // const eulas = await BigQuery.getAllEulaVersions(eulaType)
    // return eulas

    return []
  }

  /**
   * Accept EULA (create consent record)
   * @param {string} userId - User ID
   * @param {string} eulaId - EULA document ID
   * @param {object} metadata - { ipAddress, deviceInfo, userAgent }
   * @returns {object} Acceptance record
   */
  static async acceptEula(userId, eulaId, metadata = {}) {
    const { ipAddress, deviceInfo, userAgent } = metadata

    // Validate EULA exists
    // const eula = await BigQuery.getEulaDocumentById(eulaId)
    // if (!eula) throw new Error('EULA not found')

    const logId = `consent_${userId}_${eulaId}_${Date.now()}`

    const consentRecord = {
      log_id: logId,
      user_id: userId,
      eula_id: eulaId,

      acceptance_timestamp: new Date(),
      acceptance_ip_address: ipAddress,
      acceptance_device_fingerprint: metadata.deviceFingerprint || null,
      acceptance_user_agent: userAgent,
      acceptance_status: 'accepted',
    }

    // Save consent record to database
    // await BigQuery.insertConsentLog(consentRecord)

    // Also update user_consents array in user profile
    // await BigQuery.updateUserConsent(userId, consentRecord)

    return {
      accepted: true,
      acceptance_timestamp: consentRecord.acceptance_timestamp,
      log_id: logId,
    }
  }

  /**
   * Decline EULA acceptance
   * @param {string} userId - User ID
   * @param {string} eulaId - EULA document ID
   * @param {string} reason - Reason for decline
   * @returns {object} Decline record
   */
  static async declineEula(userId, eulaId, reason = '') {
    const logId = `consent_${userId}_${eulaId}_decline_${Date.now()}`

    const declineRecord = {
      log_id: logId,
      user_id: userId,
      eula_id: eulaId,
      acceptance_timestamp: new Date(),
      acceptance_status: 'declined',
      notes: reason,
    }

    // Save to database
    // await BigQuery.insertConsentLog(declineRecord)

    return {
      declined: true,
      message: 'EULA acceptance declined.',
    }
  }

  /**
   * Get user's consent history
   * @param {string} userId - User ID
   * @returns {array} User's consent records
   */
  static async getUserConsents(userId) {
    // Fetch from user_consents array in user profile
    // OR fetch from consent log table
    // const consents = await BigQuery.getUserConsents(userId)

    return []
  }

  /**
   * Check if user has accepted required EULAs
   * @param {string} userId - User ID
   * @param {array} requiredEulaTypes - Required EULA types
   * @returns {object} { allAccepted: boolean, missing: string[] }
   */
  static async checkRequiredConsents(userId, requiredEulaTypes) {
    const userConsents = await this.getUserConsents(userId)

    const acceptedTypes = userConsents
      .filter(c => c.acceptance_status === 'accepted')
      .map(c => c.eula_type)

    const missing = requiredEulaTypes.filter(type => !acceptedTypes.includes(type))

    return {
      allAccepted: missing.length === 0,
      missing,
    }
  }

  /**
   * Get next version string for EULA type
   * @param {string} eulaType - EULA type
   * @returns {string} Next version
   */
  static async getNextVersion(eulaType) {
    // Fetch latest version from database
    // const latestEula = await BigQuery.getLatestEulaVersion(eulaType)

    // For now, return default
    // if (!latestEula) return '1.0.0'

    // const [major, minor, patch] = latestEula.version.split('.').map(Number)
    // return `${major}.${minor}.${patch + 1}`

    return '1.0.0'
  }

  /**
   * Increment EULA version (minor version bump)
   * @param {string} currentVersion - Current version
   * @returns {string} New version
   */
  static incrementMinorVersion(currentVersion) {
    const [major, minor] = currentVersion.split('.').map(Number)
    return `${major}.${minor + 1}.0`
  }

  /**
   * Increment EULA version (major version bump)
   * @param {string} currentVersion - Current version
   * @returns {string} New version
   */
  static incrementMajorVersion(currentVersion) {
    const [major] = currentVersion.split('.').map(Number)
    return `${major + 1}.0.0`
  }

  /**
   * Verify if user's consent is valid/current
   * @param {string} userId - User ID
   * @param {string} eulaType - EULA type to check
   * @returns {object} { valid: boolean, reason?: string, currentVersion?: string }
   */
  static async verifyConsentValidity(userId, eulaType) {
    const currentEula = await this.getCurrentEula(eulaType)
    const userConsents = await this.getUserConsents(userId)

    const userConsent = userConsents.find(
      c => c.consent_type === eulaType && c.acceptance_status === 'accepted'
    )

    if (!userConsent) {
      return {
        valid: false,
        reason: `User has not accepted ${eulaType}`,
      }
    }

    // Check if user's accepted version matches current version
    if (userConsent.consent_version !== currentEula.version) {
      return {
        valid: false,
        reason: `User's accepted version (${userConsent.consent_version}) differs from current (${currentEula.version})`,
        currentVersion: currentEula.version,
        lastAcceptedVersion: userConsent.consent_version,
      }
    }

    return {
      valid: true,
      currentVersion: currentEula.version,
    }
  }

  /**
   * Get EULAs applicable to a user
   * @param {string} userType - User type
   * @param {string} ageGroup - Age group
   * @returns {array} Applicable EULAs
   */
  static async getApplicableEulas(userType, ageGroup) {
    // Fetch EULAs where user_types_applicable and age_groups_applicable match
    // const eulas = await BigQuery.getApplicableEulas(userType, ageGroup)

    // Mock response
    const defaultEulas = [
      { eula_type: 'terms_of_service', required: true },
      { eula_type: 'privacy_policy', required: true },
    ]

    // Add contest rules if user is opt-in to contests
    // if (userOptInToContests) {
    //   defaultEulas.push({ eula_type: 'contest_rules', required: true })
    // }

    return defaultEulas
  }
}

module.exports = EulaService
