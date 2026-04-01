// EULA/Consent Documents Model
// Manages version-controlled EULA documents for different user types and age groups

const eulaDocumentSchema = [
  { name: 'eula_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'eula_type', type: 'STRING', mode: 'REQUIRED' },
  { name: 'user_types_applicable', type: 'STRING', mode: 'REPEATED' },
  { name: 'age_groups_applicable', type: 'STRING', mode: 'REPEATED' },

  { name: 'version', type: 'STRING', mode: 'REQUIRED' },
  { name: 'major_version', type: 'INTEGER' },
  { name: 'minor_version', type: 'INTEGER' },
  { name: 'patch_version', type: 'INTEGER' },

  { name: 'content_html', type: 'STRING' },
  { name: 'content_plain_text', type: 'STRING' },

  { name: 'effective_date', type: 'DATE' },
  { name: 'superseded_date', type: 'DATE' },
  { name: 'is_current_version', type: 'BOOLEAN' },
  { name: 'requires_acceptance', type: 'BOOLEAN' },

  { name: 'created_at', type: 'DATETIME' },
  { name: 'created_by_admin_id', type: 'STRING' },
  { name: 'change_summary', type: 'STRING' },
]

// User Consent Acceptance Log
const userConsentLogSchema = [
  { name: 'log_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'eula_id', type: 'STRING', mode: 'REQUIRED' },

  { name: 'acceptance_timestamp', type: 'DATETIME' },
  { name: 'acceptance_ip_address', type: 'STRING' },
  { name: 'acceptance_device_fingerprint', type: 'STRING' },
  { name: 'acceptance_user_agent', type: 'STRING' },
  { name: 'acceptance_status', type: 'STRING' },

  { name: 'parent_verification_token_used', type: 'BOOLEAN' },
  { name: 'notes', type: 'STRING' },
]

module.exports = {
  eulaDocumentSchema,
  userConsentLogSchema,
}
