
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

const userSchema = [
    { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_email', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_password', type: 'STRING', mode: 'REQUIRED' },

    { name: 'user_gender', type: 'STRING' },
    { name: 'user_age', type: 'DATE' },
    { name: 'user_firstName', type: 'STRING' },
    { name: 'user_lastName', type: 'STRING' },
    { name: 'user_userName', type: 'STRING' },
    { name: 'user_phoneNumber', type: 'STRING' },
    { name: 'user_zipCode', type: 'STRING' },

    { name: 'user_conditions', type: 'RECORD', "mode": "REPEATED", fields: conditionSchema },
    { name: 'user_symptoms', type: 'RECORD', "mode": "REPEATED", fields: symptomSchema },
    { name: 'user_medications', type: 'RECORD', "mode": "REPEATED", fields: medicationSchema },

    { name: 'user_marketingEmail', type: 'BOOLEAN' },
    { name: 'user_marketingText', type: 'BOOLEAN' },

    { name: 'user_agreementAccepted', type: 'BOOLEAN' },
    { name: 'user_validateEmail', type: 'BOOLEAN' },
    { name: 'user_timerNotifications', type: 'INTEGER' },
    { name: 'user_restoreCode', type: 'INTEGER' },

    { name: 'user_signupDate', type: 'DATETIME' },
    { name: 'user_lastLogin', type: 'DATETIME' },
    { name: 'user_ownerApp', type: 'STRING' },
  ]

module.exports = userSchema