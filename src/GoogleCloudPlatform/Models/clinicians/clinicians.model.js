const locationSchema = [
  { name: 'latitude', type: 'FLOAT64', mode: 'REQUIRED' },
  { name: 'longitude', type: 'FLOAT64', mode: 'REQUIRED' },
]

const hoursSchema = [
  { name: 'day', type: 'STRING', mode: 'REQUIRED' },
  { name: 'opensAt', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'closesAt', type: 'DATETIME', mode: 'REQUIRED' },
]

const clinicianSchema = [
  { name: 'clinician_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_title', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_firstName', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_lastName', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_photoURL', type: 'STRING' },
  { name: 'clinician_about', type: 'STRING' },
  { name: 'clinician_specialties', type: 'STRING' },
  { name: 'clinician_certifications', type: 'BOOL' },
  { name: 'clinician_numberNPI', type: 'STRING' },

  { name: 'clinician_location', type: 'RECORD', "mode": "REPEATED", fields: locationSchema },
  { name: 'clinician_addressLine1', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_addressLine2', type: 'STRING' },
  { name: 'clinician_city', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_state', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_zip', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_country', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_phone', type: 'STRING' },
  { name: 'clinician_fax', type: 'STRING' },
  { name: 'clinician_email', type: 'STRING', mode: 'REQUIRED' },
  { name: 'clinician_website', type: 'STRING' },
  { name: 'clinician_facebook', type: 'STRING' },
  { name: 'clinician_instagram', type: 'STRING' },
  { name: 'clinician_hours', type: 'RECORD', "mode": "REPEATED", fields: hoursSchema },
  
  { name: 'clinician_status', type: 'STRING' },
  { name: 'clinician_approval', type: 'BOOL' },
  { name: 'clinician_signupDate', type: 'DATETIME' },
  { name: 'clinician_approvalDate', type: 'DATETIME' },
]

module.exports = clinicianSchema