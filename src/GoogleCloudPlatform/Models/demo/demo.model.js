
const demoSchema = [
    { name: 'demo_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'demo_email', type: 'STRING', mode: 'REQUIRED' },
    { name: 'demo_signupDate', type: 'DATETIME' },
    { name: 'demo_lastLogin', type: 'DATETIME' },
    { name: 'demo_ownerApp', type: 'STRING' },
  ]

module.exports = demoSchema