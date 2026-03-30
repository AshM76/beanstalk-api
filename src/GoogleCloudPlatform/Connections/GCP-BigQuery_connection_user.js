
const { BigQuery } = require('@google-cloud/bigquery');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = "beanstalk_users_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

async function userProfile(userid) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS u
                 WHERE u.user_id = '${userid}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Load User Profile Successfuly',
      data: {
        user: rows[0],
      }
    }
  } else {
    return {
      error: true,
      message: 'Error Load User Profile',
    }
  }
}

async function updateProfile(userid, update) {

  const updateData = []; // u.user_firstName = 'xxx', u.user_lastName = 'xxx'

  if (update['user_firstName']) {
    updateData.push(`u.user_firstName = '${update['user_firstName']}'`)
  }

  if (update['user_lastName']) {
    updateData.push(`u.user_lastName = '${update['user_lastName']}'`)
  }

  if (update['user_userName']) {
    updateData.push(`u.user_userName = '${update['user_userName']}'`)
  }

  if (update['user_phoneNumber']) {
    updateData.push(`u.user_phoneNumber = '${update['user_phoneNumber']}'`)
  }

  if (update['user_conditions']) {
    var conditionsData = []//("condition_title");
    update['user_conditions'].forEach(condition => conditionsData.push(`STRUCT('${condition['condition_title']}')`));
    updateData.push(`u.user_conditions = [${conditionsData.toString()}]`)
  }

  if (update['user_symptoms']) {
    var symptomsData = []//("symptom_title");
    update['user_symptoms'].forEach(symptom => symptomsData.push(`STRUCT('${symptom['symptom_title']}')`));
    updateData.push(`u.user_symptoms = [${symptomsData.toString()}]`)
  }

  if (update['user_medications']) {
    var medicationsData = []//("medication_title","medication_preference","medication_experience");
    update['user_medications'].forEach(medication => medicationsData.push(`('${medication['medication_title']}','${medication['medication_preference']}','${medication['medication_experience']}')`));
    updateData.push(`u.user_medications = [${medicationsData.toString()}]`)
  }

  if (update['user_timerNotifications']) {
    updateData.push(`u.user_timerNotifications = ${update['user_timerNotifications']}`)
  }

  if (update['user_marketingEmail'] == true || update['user_marketingEmail'] == false) {
    updateData.push(`u.user_marketingEmail = ${update['user_marketingEmail']}`)
  }

  if (update['user_marketingText'] == true || update['user_marketingText'] == false) {
    updateData.push(`u.user_marketingText = ${update['user_marketingText']}`)
  }

  if (update['user_email']) {
    // Query
    const query = `SELECT user_id
                  FROM ${keyDatasetId}.${keyTableId} AS u
                  WHERE u.user_email = '${update['user_email']}'
                  LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      return {
        error: true,
        message: 'Email already exists',
      }
    } else {
      console.log(`:: Email Update: ${update['user_email']}`)
      updateData.push(`u.user_email = '${update['user_email']}'`)
      updateData.push(`u.user_validateEmail = false`)
    }
  }

  console.log(updateData)

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyTableId} AS u
                   SET ${updateData}
                   WHERE u.user_id = '${userid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {

    // Query
    const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS u
                 WHERE u.user_id = '${userid}'
                 LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rowsUser] = await bigquery.query(options);

    if (rowsUser.length > 0) {
      return {
        emailUpdate: Boolean(update['user_email']),
        error: false,
        message: 'Update User Successfuly',
        data: {
          user: rowsUser[0],
        }
      }
    }

  } else {
    return {
      error: true,
      message: 'Error Update User',
    }
  }

}

async function userProfileData(userid) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS u
                 WHERE u.user_id = '${userid}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rowsProfile] = await bigquery.query(options);

  if (rowsProfile.length > 0) {

        // Table
        const keyTableSessionId = "beanstalk_sessions_data";

        // Query
        const query = `SELECT *
                      FROM ${keyDatasetId}.${keyTableSessionId} AS s
                      WHERE s.user_id = '${userid}'
                      ORDER BY s.session_startTime DESC
                      LIMIT 3`;

        const options = {
          query: query,
          location: 'US',
        };

        // Connection
        const [rowsSessions] = await bigquery.query(options);

        if (rowsSessions.length > 0) {

              // Table
              const keyTableDealsId = "beanstalk_deals_data";

              // Query
              const query = `SELECT d.deal_id, d.deal_title, d.deal_imageURL, d.deal_typeOfDeal, d.deal_amount, d.deal_offer
                             FROM ${keyDatasetId}.${keyTableDealsId} AS d
                             WHERE d.deal_status = 'published'
                             ORDER BY d.deal_createdDate DESC`;

              const options = {
                query: query,
                location: 'US',
              };

              // Connection
              const [rowsDeals] = await bigquery.query(options);

              if (rowsDeals.length > 0) {

              // Table
              const keyTableChatId = "beanstalk_chats_data";

                // Query
                const query = `CREATE TEMP FUNCTION chat_messages(chatId STRING) AS (
                              (
                                  SELECT Chat.chat_messages as messages
                                  FROM ${keyDatasetId}.${keyTableChatId} AS Chat
                                  WHERE Chat.chat_id = chatID
                                  )
                              );
                              SELECT
                              SUM (( SELECT COUNT(unreads)
                                  FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as unreads
                                  CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                                  WHERE unreads.message_id = crossMessages.message_id AND unreads.message_read = false AND unreads.message_kind = 2 
                              )) AS chat_unreads 
                              FROM ${keyDatasetId}.${keyTableChatId} AS dispensaryChats
                              WHERE dispensaryChats.chat_consumer_id = '${userid}'`;

                const options = {
                  query: query,
                  location: 'US',
                };

                // Connection
                const [rowsUnread] = await bigquery.query(options);

                if (rowsUnread.length > 0) {
                  return {
                    error: false,
                    message: 'Load Profile Data Successfuly',
                    data: {
                      user: rowsProfile[0],
                      sessions: rowsSessions,
                      deals: rowsDeals,
                      chat: rowsUnread
                    }
                  }
                } else {
                  return {
                    error: false,
                    message: 'Load Profile Data Successfuly',
                    data: {
                      user: rowsProfile[0],
                      sessions: rowsSessions,
                      deals: rowsDeals,
                      chat: [],
                    }
                  }
                }

              } else {

                // Table
                const keyTableChatId = "beanstalk_chats_data";

                // Query
                const query = `CREATE TEMP FUNCTION chat_messages(chatId STRING) AS (
                  (
                      SELECT Chat.chat_messages as messages
                      FROM ${keyDatasetId}.${keyTableChatId} AS Chat
                      WHERE Chat.chat_id = chatID
                      )
                  );
                  SELECT
                  SUM (( SELECT COUNT(unreads)
                      FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as unreads
                      CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                      WHERE unreads.message_id = crossMessages.message_id AND unreads.message_read = false AND unreads.message_kind = 2 
                  )) AS chat_unreads 
                  FROM ${keyDatasetId}.${keyTableChatId} AS dispensaryChats
                  WHERE dispensaryChats.chat_consumer_id = '${userid}'`;

                const options = {
                  query: query,
                  location: 'US',
                };

                // Connection
                const [rowsUnread] = await bigquery.query(options);

                if (rowsUnread.length > 0) {
                  return {
                    error: false,
                    message: 'Load Profile Data Successfuly',
                    data: {
                      user: rowsProfile[0],
                      sessions: rowsSessions,
                      deals: [],
                      chat: rowsUnread
                    }
                  }
                } else {
                  return {
                    error: false,
                    message: 'Load Profile Data Successfuly',
                    data: {
                      user: rowsProfile[0],
                      sessions: rowsSessions,
                      deals: [],
                      chat: [],
                    }
                  }
                }
              }

        } else {

              // Table
              const keyTableDealsId = "beanstalk_deals_data";

              // Query
              const query = `SELECT d.deal_id, d.deal_title, d.deal_imageURL, d.deal_typeOfDeal, d.deal_amount, d.deal_offer
                            FROM ${keyDatasetId}.${keyTableDealsId} AS d
                            WHERE d.deal_status = 'published'
                            ORDER BY d.deal_createdDate DESC`;

              const options = {
                query: query,
                location: 'US',
              };

              // Connection
              const [rowsDeals] = await bigquery.query(options);

              if (rowsDeals.length > 0) {
                // Table
                const keyTableChatId = "beanstalk_chats_data";
                
                // Query
                const query = `CREATE TEMP FUNCTION chat_messages(chatId STRING) AS (
                  (
                      SELECT Chat.chat_messages as messages
                      FROM ${keyDatasetId}.${keyTableChatId} AS Chat
                      WHERE Chat.chat_id = chatID
                      )
                  );
                  SELECT
                  SUM (( SELECT COUNT(unreads)
                      FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as unreads
                      CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                      WHERE unreads.message_id = crossMessages.message_id AND unreads.message_read = false AND unreads.message_kind = 2 
                  )) AS chat_unreads 
                  FROM ${keyDatasetId}.${keyTableChatId} AS dispensaryChats
                  WHERE dispensaryChats.chat_consumer_id = '${userid}'`;

                  const options = {
                    query: query,
                    location: 'US',
                  };

                  // Connection
                  const [rowsUnread] = await bigquery.query(options);

                  if (rowsUnread.length > 0) {
                    return {
                      error: false,
                      message: 'Load Profile Data Successfuly',
                      data: {
                        user: rowsProfile[0],
                        sessions: [],
                        deals: rowsDeals,
                        chat: rowsUnread
                      }
                    }
                  } else {
                    return {
                      error: false,
                      message: 'Load Profile Data Successfuly',
                      data: {
                        user: rowsProfile[0],
                        sessions: [],
                        deals: rowsDeals,
                        chat: [],
                      }
                    }
                  }

                
              } else {

                // Table
                const keyTableChatId = "beanstalk_chats_data";

                // Query
                const query = `CREATE TEMP FUNCTION chat_messages(chatId STRING) AS (
                  (
                      SELECT Chat.chat_messages as messages
                      FROM ${keyDatasetId}.${keyTableChatId} AS Chat
                      WHERE Chat.chat_id = chatID
                      )
                  );
                  SELECT
                  SUM (( SELECT COUNT(unreads)
                      FROM UNNEST(chat_messages(dispensaryChats.chat_id)) as unreads
                      CROSS JOIN UNNEST(dispensaryChats.chat_messages) AS crossMessages
                      WHERE unreads.message_id = crossMessages.message_id AND unreads.message_read = false AND unreads.message_kind = 2 
                  )) AS chat_unreads 
                  FROM ${keyDatasetId}.${keyTableChatId} AS dispensaryChats
                  WHERE dispensaryChats.chat_consumer_id = '${userid}'`;

                  const options = {
                    query: query,
                    location: 'US',
                  };

                  // Connection
                  const [rowsUnread] = await bigquery.query(options);

                  if (rowsUnread.length > 0) {
                    return {
                      error: false,
                      message: 'Load Profile Data Successfuly',
                      data: {
                        user: rowsProfile[0],
                        sessions: [],
                        deals: [],
                        chat: rowsUnread
                      }
                    }
                  } else {
                    return {
                      error: false,
                      message: 'Load Profile Data Successfuly',
                      data: {
                        user: rowsProfile[0],
                        sessions: [],
                        deals: [],
                        chat: [],
                      }
                    }
                  }
              }
        }

  } else {
    return {
      error: true,
      message: 'Error Load Profile Data',
    }
  }
}

module.exports = {
  userProfileData,
  userProfile,
  updateProfile,
}