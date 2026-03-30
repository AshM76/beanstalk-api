
const ratingSchema = [
    { name: 'consumer_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'rating', type: 'FLOAT', mode: 'REQUIRED' },
  ]

const storeRatingSchema = [
    { name: 'store_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'store_ratings', type: 'RECORD', "mode": "REPEATED", fields: ratingSchema },
  ]

module.exports = storeRatingSchema