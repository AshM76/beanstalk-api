
  const storeListSchema = [
    { name: 'store_id', type: 'STRING', mode: 'REQUIRED' }
  ]

  const accountListSchema = [
    { name: 'account_id', type: 'STRING', mode: 'REQUIRED' }
  ]

  const dispensarySchema = [
    { name: 'dispensary_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'dispensary_role_id', type: 'STRING', mode: 'REQUIRED' },
    
    { name: 'dispensary_email', type: 'STRING', mode: 'REQUIRED' },
    { name: 'dispensary_password', type: 'STRING', mode: 'REQUIRED' },

    { name: 'dispensary_license', type: 'STRING' },
    { name: 'dispensary_name', type: 'STRING', mode: 'REQUIRED' },
    { name: 'dispensary_description', type: 'STRING' },
    { name: 'dispensary_logo', type: 'STRING' },

    { name: 'dispensary_stores', type: 'RECORD', "mode": "REPEATED", fields: storeListSchema },
    { name: 'dispensary_accounts', type: 'RECORD', "mode": "REPEATED", fields: accountListSchema },
    
    { name: 'dispensary_agreementAccepted', type: 'BOOLEAN' },
    { name: 'dispensary_validateEmail', type: 'BOOLEAN' },
    { name: 'dispensary_restoreCode', type: 'INTEGER' },

    { name: 'dispensary_available', type: 'BOOLEAN' },
    
    { name: 'dispensary_signupDate', type: 'DATETIME' },
    { name: 'dispensary_lastLogin', type: 'DATETIME' },
    { name: 'dispensary_ownerApp', type: 'STRING' },

    { name: 'dispensary_role_id', type: 'STRING' },
  ]

module.exports = dispensarySchema