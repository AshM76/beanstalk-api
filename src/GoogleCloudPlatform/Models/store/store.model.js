
const photoSchema = [
  { name: 'photo_url', type: 'STRING', mode: 'REQUIRED' },
]

const hoursSchema = [
  { name: 'day', type: 'STRING', mode: 'REQUIRED' },
  { name: 'opensAt', type: 'DATETIME', mode: 'REQUIRED' },
  { name: 'closesAt', type: 'DATETIME', mode: 'REQUIRED' },
]

const storeSchema = [
  { name: 'store_id', type: 'STRING', mode: 'REQUIRED' },

  { name: 'store_name', type: 'STRING', mode: 'REQUIRED' },
  { name: 'store_photos', type: 'RECORD', "mode": "REPEATED", fields: photoSchema },
  { name: 'store_description', type: 'STRING' },
  { name: 'store_addressLine1', type: 'STRING' },
  { name: 'store_addressLine2', type: 'STRING' },
  { name: 'store_city', type: 'STRING' },
  { name: 'store_state', type: 'STRING' },
  { name: 'store_zip', type: 'STRING' },
  { name: 'store_hours', type: 'RECORD', "mode": "REPEATED", fields: hoursSchema },

  { name: 'store_phone', type: 'STRING' },
  { name: 'store_email', type: 'STRING' },

  { name: 'store_website', type: 'STRING' },
  { name: 'store_facebook', type: 'STRING' },
  { name: 'store_instagram', type: 'STRING' },
  { name: 'store_twitter', type: 'STRING' },
  { name: 'store_youtube', type: 'STRING' },

  { name: 'store_main', type: 'INTEGER' },
  { name: 'store_available', type: 'BOOLEAN' },

  { name: 'store_registerDate', type: 'DATETIME' },

  { name: 'store_dispensary_id', type: 'STRING' },
  { name: 'store_dispensary_name', type: 'STRING' },
]

module.exports = storeSchema




