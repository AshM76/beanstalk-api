
const storeListSchema = [
  { name: 'store_id', type: 'STRING', mode: 'REQUIRED' }
]

const dealSchema = [
  { name: 'deal_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'deal_title', type: 'STRING', mode: 'REQUIRED' },
  { name: 'deal_description', type: 'STRING', mode: 'REQUIRED' },
  { name: 'deal_imageURL', type: 'STRING', mode: 'REQUIRED' },
  { name: 'deal_typeOfDeal', type: 'STRING', mode: 'REQUIRED' },
  { name: 'deal_amount', type: 'STRING', mode: 'REQUIRED' },
  { name: 'deal_offer', type: 'STRING' },
  { name: 'deal_typeOfProduct', type: 'STRING' },
  { name: 'deal_brandOfProduct', type: 'STRING' },
  { name: 'deal_rangeDeal', type: 'STRING' },
  { name: 'deal_startDate', type: 'DATETIME' },
  { name: 'deal_endDate', type: 'DATETIME' },
  { name: 'deal_url', type: 'STRING' },
  { name: 'deal_publish_pushDate', type: 'DATETIME' },
  { name: 'deal_publish_smsDate', type: 'DATETIME' },
  { name: 'deal_publish_emailDate', type: 'DATETIME' },
  { name: 'deal_publish_timeZone', type: 'STRING' },
  { name: 'deal_status', type: 'STRING' },
  { name: 'deal_createdDate', type: 'DATETIME' },

  { name: 'deal_dispensary_id', type: 'STRING' },
  { name: 'deal_dispensary_name', type: 'STRING' },
  { name: 'deal_stores_availables', type: 'RECORD', "mode": "REPEATED", fields: storeListSchema },
]

module.exports = dealSchema