
const { BigQuery } = require('@google-cloud/bigquery');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = "beanstalk_chats_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

async function chatListByConsumer(consumerId) {

    // Dispensaries Table
    const keyDispensariesTableId = "beanstalk_dispensaries_data";

    // Stores Table
    const keyStoresTableId = "beanstalk_stores_data";

    // Query
    const query = `CREATE TEMP FUNCTION chat_messages(chatId STRING) AS (
                    (
                        SELECT Chat.chat_messages as messages
                        FROM ${keyDatasetId}.${keyTableId} AS Chat
                        WHERE Chat.chat_id = chatID
                        )
                    );
    
                    SELECT dispensaryChats.* EXCEPT(chat_consumer_id, chat_messages, chat_initDate),
                    (SELECT d.dispensary_name FROM ${keyDatasetId}.${keyDispensariesTableId} AS d WHERE d.dispensary_id = dispensaryChats.chat_dispensary_id) AS chat_dispensary_name,
                    (SELECT s.store_name FROM ${keyDatasetId}.${keyStoresTableId} AS s WHERE s.store_id = dispensaryChats.chat_store_id) AS chat_store_name,                           

                    ( SELECT lastChat.message_content
                        FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as lastChat
                        CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                        WHERE lastChat.message_id = crossMessages.message_id
                        ORDER BY lastChat.message_date DESC
                        LIMIT 1 
                    ) AS chat_lastMessage,

                    ( SELECT lastChat.message_date
                        FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as lastChat
                        CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                        WHERE lastChat.message_id = crossMessages.message_id
                        ORDER BY lastChat.message_date DESC
                        LIMIT 1
                    ) AS chat_lastDate,

                    ( SELECT COUNT(unreads)
                        FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as unreads
                        CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                        WHERE unreads.message_id = crossMessages.message_id AND unreads.message_read = false AND unreads.message_kind = 2 
                    ) AS chat_unreads 

                    FROM ${keyDatasetId}.${keyTableId} AS dispensaryChats
                    WHERE dispensaryChats.chat_consumer_id = '${consumerId}'
                    ORDER BY chat_lastDate DESC`;

    const options = {
        query: query,
        location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
        return {
            error: false,
            message: 'Load Chat List By Consumer Successfuly',
            data: {
                chats: rows,
            }
        }
    } else {
        return {
            error: true,
            message: 'Error Chat List By Consumer Does Not Exist',
        }
    }
}

async function chatListByDispensary(dispensaryId) {

    // Users Table
    const keyUsersTableId = "beanstalk_users_data";
    // Stores Table
    const keyStoresTableId = "beanstalk_stores_data";

    // Query
    const query = `CREATE TEMP FUNCTION chat_messages(chatId STRING) AS (
                    (
                        SELECT Chat.chat_messages as messages
                        FROM ${keyDatasetId}.${keyTableId} AS Chat
                        WHERE Chat.chat_id = chatID
                        )
                    );

                    SELECT dispensaryChats.* EXCEPT(chat_dispensary_id, chat_messages, chat_initDate),
                    
                    ( SELECT IF((CONCAT(u.user_firstName, ' ', u.user_lastName) != ' '),CONCAT(u.user_firstName, ' ', u.user_lastName), u.user_userName)
                      FROM ${keyDatasetId}.${keyUsersTableId} AS u 
                      WHERE u.user_id = dispensaryChats.chat_consumer_id ) AS chat_consumer_name,
                    
                    ( SELECT s.store_name
                      FROM ${keyDatasetId}.${keyStoresTableId} AS s 
                      WHERE s.store_id = dispensaryChats.chat_store_id ) AS chat_store_name,

                    ( SELECT lastChat.message_content
                        FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as lastChat
                        CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                        WHERE lastChat.message_id = crossMessages.message_id
                        ORDER BY lastChat.message_date DESC
                        LIMIT 1 
                    ) AS chat_lastMessage,

                    ( SELECT lastChat.message_date
                        FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as lastChat
                        CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                        WHERE lastChat.message_id = crossMessages.message_id
                        ORDER BY lastChat.message_date DESC
                        LIMIT 1
                    ) AS chat_lastDate,

                    ( SELECT COUNT(unreads)
                        FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as unreads
                        CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                        WHERE unreads.message_id = crossMessages.message_id AND unreads.message_read = false AND unreads.message_kind = 1 
                    ) AS chat_unreads 

                    FROM ${keyDatasetId}.${keyTableId} AS dispensaryChats
                    WHERE dispensaryChats.chat_dispensary_id = '${dispensaryId}'
                    ORDER BY chat_lastDate DESC`;


    const options = {
        query: query,
        location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
        return {
            error: false,
            message: 'Load Chat List By Dispensary Successfuly',
            data: {
                chats: rows,
            }
        }
    } else {
        return {
            error: true,
            message: 'Error Chat List By Dispensary Does Not Exist',
        }
    }
}

async function chatHistory(consumerId, dispensaryId, storeId, kind) {

    // Query Update All Reads
    const query = `CREATE TEMP FUNCTION chat_messages(chatId STRING) AS (
                    (
                        SELECT Chat.chat_messages as messages
                        FROM ${keyDatasetId}.${keyTableId} AS Chat
                        WHERE Chat.chat_id = chatID
                    )
                   );
                   UPDATE ${keyDatasetId}.${keyTableId} AS c
                   SET c.chat_messages = ARRAY(
                        SELECT IF(m.message_kind = ${kind},(m.message_id, m.message_date, m.message_content , message_owner, TRUE, m.message_type, m.message_kind),(m.message_id, m.message_date, m.message_content, message_owner , m.message_read, m.message_type, m.message_kind)),
                        FROM UNNEST(chat_messages(c.chat_id)) AS m
                   )
                   WHERE c.chat_consumer_id = '${consumerId}' AND c.chat_dispensary_id = '${dispensaryId}'
                 `;

    const options = {
        query: query,
        location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    if (rows) {

        // Users Table
        const keyUsersTableId = "beanstalk_users_data";
        // Dispensaries Table
        const keyDispensariesTableId = "beanstalk_dispensaries_data";

        // Stores Table
        const keyStoresTableId = "beanstalk_stores_data";

        // Query
        const query = `SELECT c.*,
                       ( SELECT IF((CONCAT(u.user_firstName, ' ', u.user_lastName) != ' '),CONCAT(u.user_firstName, ' ', u.user_lastName), u.user_userName)
                         FROM ${keyDatasetId}.${keyUsersTableId} AS u 
                         WHERE u.user_id = '${consumerId}' ) AS chat_consumer_name,
                       (SELECT d.dispensary_name FROM ${keyDatasetId}.${keyDispensariesTableId} AS d WHERE d.dispensary_id = '${dispensaryId}' ) AS chat_dispensary_name,
                       (SELECT s.store_name FROM ${keyDatasetId}.${keyStoresTableId} AS s WHERE s.store_id = '${storeId}' ) AS chat_store_name                              
                       FROM ${keyDatasetId}.${keyTableId} AS c
                       WHERE c.chat_consumer_id = '${consumerId}' AND c.chat_dispensary_id = '${dispensaryId}' AND c.chat_store_id = '${storeId}'
                       LIMIT 1
                      `;

        const options = {
            query: query,
            location: 'US',
        };

        // Connection
        const [rows] = await bigquery.query(options);

        if (rows.length > 0) {
            return {
                error: false,
                message: 'Load Chat History Successfuly',
                data: {
                    chat: rows[0],
                }
            }
        } else {
            return {
                error: true,
                message: 'Error Chat History Does Not Exist',
            }
        }

    } else {
        return {
            error: true,
            message: 'Error Update Chat Reads',
        }
    }
}

async function chatCreate(chat) {

    // Data
    var messagesData = []//("message_id","message_date","message_content","message_owner","message_type","message_kind ");
    if (chat['messages']) {
        chat['messages'].forEach(message => {
            var date = new Date(message['message_date'])
            messagesData.push(`(GENERATE_UUID(),
                                PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${date.toUTCString()}'),
                                '${message['message_content']}',
                                '${message['message_owner']}',
                                ${message['message_read']},
                                '${message['message_type']}',
                                 ${message['message_kind']}
                               )`)
        });
    }

    // Query
    const query = `INSERT ${keyDatasetId}.${keyTableId} (
                    chat_id,
                    chat_consumer_id,
                    chat_dispensary_id,
                    chat_store_id,

                    chat_messages,
  
                    chat_initDate
                    )
                  VALUES (
                    GENERATE_UUID(),
                    '${chat['consumer_id']}',
                    '${chat['dispensary_id']}',
                    '${chat['store_id']}',
                    
                    [${messagesData.toString()}],
                    
                    CURRENT_DATETIME()
                    )
                  `;

    const options = {
        query: query,
        location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);
    console.log(rows)
    if (rows) {
        const query = `SELECT *
                     FROM ${keyDatasetId}.${keyTableId} AS c
                     WHERE c.chat_consumer_id = '${chat['consumer_id']}' AND c.chat_dispensary_id = '${chat['dispensary_id']}' AND c.chat_store_id = '${chat['store_id']}'
                     ORDER BY c.chat_initDate DESC
                     LIMIT 1`;

        const options = {
            query: query,
            location: 'US',
        };

        const [rows] = await bigquery.query(options);
        console.log(rows)
        if (rows.length > 0) {
            return {
                error: false,
                message: 'Chat Created Successfuly',
                data: {
                    chat: rows[0],
                }
            }
        } else {
            return {
                error: true,
                message: 'Chat Create Error',
            }
        }
    } else {
        return {
            error: true,
            message: 'Chat Create Error',
        }
    }
}

async function chatSaveMessage(chatId, message) {

    console.log(chatId)
    console.log(message)

    //ADD DATA
    var date = new Date(message['message_date'])
    var messageData = (`(GENERATE_UUID(),
                         PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${date.toUTCString()}'),
                         "${message['message_content']}",
                         '${message['message_owner']}',
                         ${message['message_read']},
                         '${message['message_type']}',
                          ${message['message_kind']}
                        )`)

    // Query
    const query = `UPDATE ${keyDatasetId}.${keyTableId} AS c
                   SET c.chat_messages = ARRAY_CONCAT(c.chat_messages ,[${messageData.toString()}])
                   WHERE c.chat_id = '${chatId}'
                  `;

    const options = {
        query: query,
        location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);
    // Response
    if (rows) {
        return {
            error: false,
            message: 'Saved Chat Successfuly',
        }
    } else {
        return {
            error: true,
            message: 'Error Saved Chat',
        }
    }

}

async function chatMarkReadMessage(chatId, kind) {

    // Query Update All Reads
    const query = `CREATE TEMP FUNCTION chat_messages(chatId STRING) AS (
    (
        SELECT Chat.chat_messages as messages
        FROM ${keyDatasetId}.${keyTableId} AS Chat
        WHERE Chat.chat_id = chatId
    )
    );
    UPDATE ${keyDatasetId}.${keyTableId} AS c
    SET c.chat_messages = ARRAY(
        SELECT IF(m.message_kind = ${kind},(m.message_id, m.message_date, m.message_content , TRUE, m.message_type, m.message_kind),(m.message_id, m.message_date, m.message_content , m.message_read, m.message_type, m.message_kind)),
                            FROM UNNEST(chat_messages(c.chat_id)) AS m
                            )
    WHERE c.chat_id = '${chatId}'`;

    const options = {
        query: query,
        location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    // Response
    if (rows) {
        return {
            error: false,
            message: 'Update Reading Chat Successfuly',
        }
    } else {
        return {
            error: true,
            message: 'Error Update Reading Chat',
        }
    }
}

async function chatUpdateMessage(chatId, update) {

    //ADD DATA
    var messagesData = []//("message_id","message_date","message_content","message_type","message_kind ");

    if (update['messages']) {
        update['messages'].forEach(message => {
            var date = new Date(message['message_date'])
            messagesData.push(`(GENERATE_UUID(),
                                PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${date.toUTCString()}'),
                                '${message['message_content']}',
                                '${message['message_owner']}',
                                '${message['message_read']}',
                                '${message['message_type']}',
                                 ${message['message_kind']}
                               )`)
        });
    }

    // Query
    const query = `UPDATE ${keyDatasetId}.${keyTableId} AS c
                   SET c.chat_messages = ARRAY_CONCAT(c.chat_messages ,[${messagesData.toString()}])
                   WHERE c.chat_id = '${chatId}'`;

    const options = {
        query: query,
        location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    if (rows) {

        // Query
        const query = `SELECT *
                   FROM ${keyDatasetId}.${keyTableId} AS c
                   WHERE c.chat_id = '${chatId}'
                   LIMIT 1`;

        const options = {
            query: query,
            location: 'US',
        };

        // Connection
        const [rowsChat] = await bigquery.query(options);

        if (rowsChat.length > 0) {

            return {
                error: false,
                message: 'Update Chat Successfuly',
                data: {
                    chat: rowsChat[0],
                }
            }
        }

    } else {
        return {
            error: true,
            message: 'Error Update Chat',
        }
    }
}

module.exports = {
    chatListByConsumer,
    chatListByDispensary,
    chatHistory,
    chatCreate,
    chatSaveMessage,
    chatMarkReadMessage,
    chatUpdateMessage,
}