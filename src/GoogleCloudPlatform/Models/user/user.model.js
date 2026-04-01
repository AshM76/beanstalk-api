
const conditionSchema = [
    { name: 'condition_title', type: 'STRING', mode: 'REQUIRED' },
  ]

const symptomSchema = [
    { name: 'symptom_title', type: 'STRING', mode: 'REQUIRED' },
  ]

const medicationSchema = [
    { name: 'medication_title', type: 'STRING', mode: 'REQUIRED' },
    { name: 'medication_preference', type: 'STRING', mode: 'REQUIRED' },
    { name: 'medication_experience', type: 'STRING', mode: 'REQUIRED' },
  ]

const consentSchema = [
    { name: 'consent_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'consent_type', type: 'STRING', mode: 'REQUIRED' },
    { name: 'consent_version', type: 'STRING', mode: 'REQUIRED' },
    { name: 'consent_accepted', type: 'BOOLEAN', mode: 'REQUIRED' },
    { name: 'consent_accepted_at', type: 'DATETIME' },
    { name: 'consent_accepted_from_ip', type: 'STRING' },
    { name: 'consent_accepted_device_info', type: 'STRING' },
    { name: 'user_type_at_consent', type: 'STRING' },
  ]

const userSchema = [
    // ── Core Account ──────────────────────────────────────────
    { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_email', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_password', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_userName', type: 'STRING' },

    // ── Age & Verification ────────────────────────────────────
    { name: 'user_dateOfBirth', type: 'DATE' },
    { name: 'user_age_verified', type: 'BOOLEAN', mode: 'NULLABLE', defaultValue: false },
    { name: 'user_age_verification_method', type: 'STRING' },
    { name: 'user_age_verification_timestamp', type: 'DATETIME' },
    { name: 'user_age_group', type: 'STRING' },
    { name: 'user_age_group_updated_at', type: 'DATETIME' },

    // ── Personal Information ──────────────────────────────────
    { name: 'user_firstName', type: 'STRING' },
    { name: 'user_lastName', type: 'STRING' },
    { name: 'user_gender', type: 'STRING' },
    { name: 'user_phoneNumber', type: 'STRING' },

    // ── Demographics (new) ────────────────────────────────────
    { name: 'user_city', type: 'STRING' },
    { name: 'user_state', type: 'STRING' },
    { name: 'user_country', type: 'STRING' },
    { name: 'user_zipCode', type: 'STRING' },
    { name: 'user_education_level', type: 'STRING' },
    { name: 'user_income_bracket', type: 'STRING' },
    { name: 'user_primary_interest', type: 'STRING' },
    { name: 'user_risk_tolerance', type: 'STRING' },

    // ── Parental Consent (for under 18) ───────────────────────
    { name: 'user_parent_name', type: 'STRING' },
    { name: 'user_parent_email', type: 'STRING' },
    { name: 'user_parent_consent', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'user_parent_consent_timestamp', type: 'DATETIME' },
    { name: 'user_parent_email_verified', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'user_parent_verification_token', type: 'STRING' },
    { name: 'user_parent_verification_token_expires', type: 'DATETIME' },

    // ── Medical Profile ───────────────────────────────────────
    { name: 'user_conditions', type: 'RECORD', "mode": "REPEATED", fields: conditionSchema },
    { name: 'user_symptoms', type: 'RECORD', "mode": "REPEATED", fields: symptomSchema },
    { name: 'user_medications', type: 'RECORD', "mode": "REPEATED", fields: medicationSchema },

    // ── EULA & Consent Tracking ───────────────────────────────
    { name: 'user_consents', type: 'RECORD', "mode": "REPEATED", fields: consentSchema },
    { name: 'user_agreementAccepted', type: 'BOOLEAN' },
    { name: 'user_validateEmail', type: 'BOOLEAN' },

    // ── Preferences ───────────────────────────────────────────
    { name: 'user_marketingEmail', type: 'BOOLEAN' },
    { name: 'user_marketingText', type: 'BOOLEAN' },

    // ── Contest Participation ─────────────────────────────────
    { name: 'user_contest_eligible', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'user_contest_opt_in', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'user_virtual_portfolio_account_id', type: 'STRING' },
    { name: 'user_portfolio_decimal_places_precision', type: 'INTEGER' },

    // ── Account Status ────────────────────────────────────────
    { name: 'user_account_status', type: 'STRING' },
    { name: 'user_account_status_reason', type: 'STRING' },

    // ── Notifications & Misc ──────────────────────────────────
    { name: 'user_timerNotifications', type: 'INTEGER' },
    { name: 'user_restoreCode', type: 'INTEGER' },
    { name: 'user_ownerApp', type: 'STRING' },

    // ── Timestamps ────────────────────────────────────────────
    { name: 'user_signupDate', type: 'DATETIME' },
    { name: 'user_account_created_at', type: 'DATETIME' },
    { name: 'user_account_verified_at', type: 'DATETIME' },
    { name: 'user_lastLogin', type: 'DATETIME' },
  ]

module.exports = userSchema