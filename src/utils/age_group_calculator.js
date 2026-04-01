/**
 * Age Group Calculator
 * Handles age calculations and age group classification for Beanstalk
 *
 * Age Groups:
 * - middle_school: 13-14 years
 * - high_school: 15-18 years
 * - college: 19-25 years
 * - adults: 26+ years
 */

/**
 * Calculate age in years from date of birth
 * @param {Date|string} dateOfBirth - Date of birth as Date object or YYYY-MM-DD string
 * @returns {number} Age in years, or null if invalid
 */
function calculateAge(dateOfBirth) {
  try {
    // Parse string to Date if needed
    let dob = dateOfBirth
    if (typeof dateOfBirth === 'string') {
      dob = new Date(dateOfBirth)
    }

    // Validate date
    if (!(dob instanceof Date) || isNaN(dob.getTime())) {
      return null
    }

    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()

    // Adjust if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }

    return age
  } catch (error) {
    console.error('Error calculating age:', error)
    return null
  }
}

/**
 * Determine age group from date of birth
 * @param {Date|string} dateOfBirth - Date of birth as Date object or YYYY-MM-DD string
 * @returns {string|null} Age group: 'middle_school' | 'high_school' | 'college' | 'adults' | null
 */
function calculateAgeGroup(dateOfBirth) {
  const age = calculateAge(dateOfBirth)

  if (age === null) {
    return null
  }

  // Minimum age: 13
  if (age < 13) {
    return null // Too young for platform
  }

  // Age group boundaries
  if (age <= 14) {
    return 'middle_school' // 13-14
  }
  if (age <= 18) {
    return 'high_school' // 15-18
  }
  if (age <= 25) {
    return 'college' // 19-25
  }

  return 'adults' // 26+
}

/**
 * Check if user requires parental consent based on age
 * @param {Date|string} dateOfBirth - Date of birth
 * @returns {boolean} True if parental consent is required (age < 18)
 */
function requiresParentalConsent(dateOfBirth) {
  const age = calculateAge(dateOfBirth)
  return age !== null && age < 18
}

/**
 * Validate date of birth format and constraints
 * @param {string} dobString - Date of birth as YYYY-MM-DD string
 * @returns {object} { valid: boolean, error: string|null, age: number|null }
 */
function validateDateOfBirth(dobString) {
  // Check format: YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dobString)) {
    return {
      valid: false,
      error: 'Date of birth must be in YYYY-MM-DD format',
      age: null,
    }
  }

  const dob = new Date(dobString)

  // Check if valid date
  if (isNaN(dob.getTime())) {
    return {
      valid: false,
      error: 'Invalid date of birth',
      age: null,
    }
  }

  // Check if future date
  const today = new Date()
  if (dob > today) {
    return {
      valid: false,
      error: 'Date of birth cannot be in the future',
      age: null,
    }
  }

  const age = calculateAge(dob)

  // Check minimum age (13)
  if (age < 13) {
    return {
      valid: false,
      error: 'Must be at least 13 years old to use this platform',
      age,
    }
  }

  // Check maximum age (reasonable upper limit)
  if (age > 120) {
    return {
      valid: false,
      error: 'Please check your date of birth',
      age,
    }
  }

  return {
    valid: true,
    error: null,
    age,
  }
}

/**
 * Check if user is old enough for specific contest type
 * @param {number} age - User's age in years
 * @param {string} contestType - Type of contest: 'beginner' | 'intermediate' | 'advanced'
 * @returns {boolean} True if user meets age requirement for contest type
 */
function isOldEnoughForContest(age, contestType = 'beginner') {
  // Beginner contests: 13+
  if (contestType === 'beginner') {
    return age >= 13
  }

  // Intermediate contests: 16+
  if (contestType === 'intermediate') {
    return age >= 16
  }

  // Advanced contests: 18+
  if (contestType === 'advanced') {
    return age >= 18
  }

  return false
}

/**
 * Get age group restrictions/features
 * Returns available features for each age group
 * @param {string} ageGroup - Age group: 'middle_school' | 'high_school' | 'college' | 'adults'
 * @returns {object} Feature restrictions/access levels
 */
function getAgeGroupFeatures(ageGroup) {
  const features = {
    middle_school: {
      ageGroup: 'middle_school',
      minAge: 13,
      maxAge: 14,
      canCreateContests: false,
      canJoinContests: true,
      contestTypes: ['beginner'],
      requiresParentalConsent: true,
      requiresParentalConsentForContests: true,
      canAccessRealPrizes: false,
      maxPortfolioValue: 100000, // $100k virtual
    },
    high_school: {
      ageGroup: 'high_school',
      minAge: 15,
      maxAge: 18,
      canCreateContests: false,
      canJoinContests: true,
      contestTypes: ['beginner', 'intermediate'],
      requiresParentalConsent: true,
      requiresParentalConsentForContests: true,
      canAccessRealPrizes: false,
      maxPortfolioValue: 500000, // $500k virtual
    },
    college: {
      ageGroup: 'college',
      minAge: 19,
      maxAge: 25,
      canCreateContests: false,
      canJoinContests: true,
      contestTypes: ['beginner', 'intermediate', 'advanced'],
      requiresParentalConsent: false,
      requiresParentalConsentForContests: false,
      canAccessRealPrizes: false, // Still virtual
      maxPortfolioValue: 1000000, // $1M virtual
    },
    adults: {
      ageGroup: 'adults',
      minAge: 26,
      maxAge: 120,
      canCreateContests: true,
      canJoinContests: true,
      contestTypes: ['beginner', 'intermediate', 'advanced'],
      requiresParentalConsent: false,
      requiresParentalConsentForContests: false,
      canAccessRealPrizes: true, // Can win real prizes (future)
      maxPortfolioValue: 10000000, // $10M virtual
    },
  }

  return features[ageGroup] || null
}

/**
 * Compare two ages/age groups for contest matching
 * @param {string} ageGroup1 - First age group
 * @param {string} ageGroup2 - Second age group
 * @returns {boolean} True if age groups are the same
 */
function isSameAgeGroup(ageGroup1, ageGroup2) {
  return ageGroup1 === ageGroup2
}

/**
 * Get all valid age groups
 * @returns {array} Array of valid age group enum values
 */
function getValidAgeGroups() {
  return ['middle_school', 'high_school', 'college', 'adults']
}

/**
 * Format date of birth for display
 * @param {Date|string} dateOfBirth - Date of birth
 * @returns {string} Formatted date string (MM/DD/YYYY)
 */
function formatDateOfBirth(dateOfBirth) {
  let dob = dateOfBirth
  if (typeof dateOfBirth === 'string') {
    dob = new Date(dateOfBirth)
  }

  if (!(dob instanceof Date) || isNaN(dob.getTime())) {
    return null
  }

  const month = String(dob.getMonth() + 1).padStart(2, '0')
  const day = String(dob.getDate()).padStart(2, '0')
  const year = dob.getFullYear()

  return `${month}/${day}/${year}`
}

/**
 * Parse date of birth from MM/DD/YYYY format to YYYY-MM-DD
 * @param {string} dateString - Date string in MM/DD/YYYY format
 * @returns {string|null} Date string in YYYY-MM-DD format or null if invalid
 */
function parseDateOfBirth(dateString) {
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = dateString.match(dateRegex)

  if (!match) {
    return null
  }

  const [, month, day, year] = match
  const paddedMonth = String(month).padStart(2, '0')
  const paddedDay = String(day).padStart(2, '0')

  return `${year}-${paddedMonth}-${paddedDay}`
}

module.exports = {
  calculateAge,
  calculateAgeGroup,
  requiresParentalConsent,
  validateDateOfBirth,
  isOldEnoughForContest,
  getAgeGroupFeatures,
  isSameAgeGroup,
  getValidAgeGroups,
  formatDateOfBirth,
  parseDateOfBirth,
}
