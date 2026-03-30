
const dispensaryStoreIdSchema = [
    { name: 'store_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'active', type: 'BOOL', mode: 'REQUIRED' },
  ]

const userDispensaryStoreFavoritesSchema = [
    { name: 'consumer_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'store_list', type: 'RECORD', "mode": "REPEATED", fields: dispensaryStoreIdSchema },
  ]

module.exports = userDispensaryStoreFavoritesSchema