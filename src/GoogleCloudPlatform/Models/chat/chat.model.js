
  const messageSchema = [
    { name: 'message_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'message_date', type: 'DATETIME', mode: 'REQUIRED' },
    { name: 'message_content', type: 'STRING' },
    { name: 'message_owner', type: 'STRING' },
    { name: 'message_read', type: 'BOOL'},
    { name: 'message_type', type: 'STRING' },
    { name: 'message_kind', type: 'INTEGER' },
  ]

  const chatSchema = [
    { name: 'chat_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'chat_consumer_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'chat_dispensary_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'chat_store_id', type: 'STRING', mode: 'REQUIRED' },

    { name: 'chat_messages', type: 'RECORD', "mode": "REPEATED", fields: messageSchema },

    { name: 'chat_initDate', type: 'DATETIME' },
  ]

module.exports = chatSchema