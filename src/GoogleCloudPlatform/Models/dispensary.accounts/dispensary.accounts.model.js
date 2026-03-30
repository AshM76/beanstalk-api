  const dispensaryAccountsSchema = [
    { name: 'dispensary_id', type: 'STRING', mode: 'REQUIRED' },
    
    { name: 'dispensary_account_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'dispensary_account_email', type: 'STRING', mode: 'REQUIRED' },
    { name: 'dispensary_account_fullname', type: 'STRING', mode: 'REQUIRED' },
    { name: 'dispensary_account_password', type: 'STRING', mode: 'REQUIRED' },
    
    { name: 'dispensary_account_store', type: 'STRING', mode: 'REQUIRED' },
    
    { name: 'dispensary_account_available', type: 'BOOLEAN' },

    { name: 'dispensary_account_signupDate', type: 'DATETIME' },
    { name: 'dispensary_account_lastLogin', type: 'DATETIME' },
    { name: 'dispensary_account_ownerApp', type: 'STRING' },
  ]

module.exports = dispensaryAccountsSchema