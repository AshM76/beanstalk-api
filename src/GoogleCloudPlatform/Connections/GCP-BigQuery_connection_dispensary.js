
const { BigQuery } = require('@google-cloud/bigquery');

const bcrypt = require('bcryptjs');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Tables
const keyDispensariesTableId = "beanstalk_dispensaries_data";
const keyStoresTableId = "beanstalk_stores_data";
const keyAccountsTableId = "beanstalk_dispensaries_accounts_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

// Dispensary Profile
async function dataDispensaryDashboard(dispensaryId) {

  // Table
  const keyDealsTableId = "beanstalk_deals_data";
  const keyChatsTableId = "beanstalk_chats_data";

  // Query   
  const query = `SELECT dispensary_id, d.dispensary_email, d.dispensary_name, d.dispensary_logo,
                 (
                    SELECT COUNT(s.store_id)
                    FROM ${keyDatasetId}.${keyStoresTableId} AS s
                    WHERE s.store_dispensary_id = d.dispensary_id 
                 ) AS stores,
                
                 (   SELECT COUNT(a.dispensary_account_id)
                     FROM ${keyDatasetId}.${keyAccountsTableId} AS a
                     WHERE a.dispensary_id = d.dispensary_id
                 ) AS users,
                
                 (   SELECT AS STRUCT COUNTIF(deal.deal_status = 'published') AS published, COUNTIF(deal.deal_status = 'saved') AS saved, COUNTIF(deal.deal_status = 'closed') AS closed
                     FROM ${keyDatasetId}.${keyDealsTableId} AS deal
                     WHERE deal.deal_dispensary_id = d.dispensary_id
                 ) AS deals,

                 (   SELECT COUNT(c.chat_id)
                     FROM ${keyDatasetId}.${keyChatsTableId} AS c
                     WHERE c.chat_dispensary_id = d.dispensary_id
                 ) AS chats 

                 FROM ${keyDatasetId}.${keyDispensariesTableId} AS d
                 WHERE d.dispensary_id = '${dispensaryId}'
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
      message: 'Dispensary Dashboard Successfuly',
      data: {
        dashboard: {
          dispensary : {
            dispensary_id: rows[0]['dispensary_id'],
            dispensary_email: rows[0]['dispensary_email'],
            dispensary_name: rows[0]['dispensary_name'],
            dispensary_logo: rows[0]['dispensary_logo'],
          },

          stores: {
            registered: rows[0]['stores'],
          },
        
          users: {
            registered: rows[0]['users'],
          },
        
          deals: {
            published: rows[0]['deals']['published'],
            saved: rows[0]['deals']['saved'],
            closed: rows[0]['deals']['closed'],
          },
        
          chats: {
            unread: rows[0]['chats'],
          }
        }
      }
    }
  } else {
    return {
      error: false,
      message: 'Dispensaries Data does not exist',
      data: {
        dashboard: [],
      }
    }
  }
}

// Dispensary Profile
async function dataDispensaryProfile(dispensaryId) {

  // Query   
  const query = `CREATE TEMP FUNCTION store_info(dispensaryID STRING) AS (
                  (
                      ARRAY(
                        SELECT AS STRUCT s.store_id, s.store_name, s.store_photos, s.store_addressLine1, s.store_city, s.store_state, store_available
                        FROM ${keyDatasetId}.${keyStoresTableId} AS s
                        WHERE s.store_dispensary_id = dispensaryID  
                      )                     
                  )
                );

                CREATE TEMP FUNCTION account_info(dispensaryID STRING) AS (
                  (
                      ARRAY(
                        SELECT AS STRUCT a.dispensary_account_id, a.dispensary_account_email, a.dispensary_account_fullname, a.dispensary_account_store, a.dispensary_account_available,
                        FROM ${keyDatasetId}.${keyAccountsTableId}  AS a
                        WHERE a.dispensary_id = dispensaryID  
                      )                     
                  )
                );
    
                SELECT d.* EXCEPT(dispensary_password, dispensary_stores, dispensary_accounts, dispensary_agreementAccepted, dispensary_validateEmail, dispensary_restoreCode, dispensary_signupDate, dispensary_lastLogin, dispensary_ownerApp),
                store_info(d.dispensary_id) as dispensary_stores,
                account_info(d.dispensary_id) as dispensary_accounts
                FROM ${keyDatasetId}.${keyDispensariesTableId} AS d
                WHERE d.dispensary_id = '${dispensaryId}'
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
      message: 'Dispensary Data Successfuly',
      data: {
        dispensary: rows[0],
      }
    }
  } else {
    return {
      error: false,
      message: 'Dispensaries Data does not exist',
      data: {
        dispensaries: [],
      }
    }
  }
}

async function updateDispensaryProfile(dispensaryId, update) {

  const updateData = [];

  if (update['dispensary_password']) {
    updateData.push(`d.dispensary_password = '${update['dispensary_password']}'`)
  }

  if (update['dispensary_license']) {
    updateData.push(`d.dispensary_license = '${update['dispensary_license']}'`)
  }

  if (update['dispensary_name']) {
    updateData.push(`d.dispensary_name = '${update['dispensary_name']}'`)
  }

  if (update['dispensary_description']) {
    updateData.push(`d.dispensary_description = '${update['dispensary_description']}'`)
  }

  if (update['dispensary_logo']) {
    updateData.push(`d.dispensary_logo = '${update['dispensary_logo']}'`)
  }

  if (update['dispensary_email']) {
    // Query
    const query = `SELECT d.dispensary_id
                  FROM ${keyDatasetId}.${keyDispensariesTableId} AS d
                  WHERE d.dispensary_email = '${update['dispensary_email']}'
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
      console.log(`:: Email Update: ${update['dispensary_email']}`)
      updateData.push(`d.dispensary_email = '${update['dispensary_email']}'`)
      updateData.push(`d.dispensary_validateEmail = false`)
    }
  }

  console.log(updateData)

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyDispensariesTableId} AS d
                 SET ${updateData}
                 WHERE d.dispensary_id = '${dispensaryId}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    // Query   
    const query = `CREATE TEMP FUNCTION store_info(dispensaryID STRING) AS (
                    (
                        ARRAY(
                          SELECT AS STRUCT s.store_id, s.store_name, s.store_addressLine1, s.store_city, s.store_state, store_available
                          FROM ${keyDatasetId}.${keyStoresTableId} AS s
                          WHERE s.store_dispensary_id = dispensaryID  
                        )                     
                    )
                  );

                  CREATE TEMP FUNCTION account_info(dispensaryID STRING) AS (
                    (
                        ARRAY(
                          SELECT AS STRUCT a.dispensary_account_id, a.dispensary_account_email, a.dispensary_account_fullname, a.dispensary_account_store, a.dispensary_account_available,
                          FROM ${keyDatasetId}.${keyAccountsTableId}  AS a
                          WHERE a.dispensary_id = dispensaryID  
                        )                     
                    )
                  );
      
                  SELECT d.* EXCEPT(dispensary_password, dispensary_stores, dispensary_accounts, dispensary_agreementAccepted, dispensary_validateEmail, dispensary_restoreCode, dispensary_signupDate, dispensary_lastLogin, dispensary_ownerApp),
                  store_info(d.dispensary_id) as dispensary_stores,
                  account_info(d.dispensary_id) as dispensary_accounts
                  FROM ${keyDatasetId}.${keyDispensariesTableId} AS d
                  WHERE d.dispensary_id = '${dispensaryId}'
                  `;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rowsDispensary] = await bigquery.query(options);

    if (rowsDispensary.length > 0) {
      return {
        emailUpdate: Boolean(update['dispensary_email']),
        error: false,
        message: 'Update Dispensary Profile Successfuly',
        data: {
          dispensary: rowsDispensary[0],
        }
      }
    }

  } else {
    return {
      error: true,
      message: 'Error Update Dispensary Profile',
    }
  }

}

// Stores Profile
async function getStoreDispensaryProfile(storeId) {

  // Query   
  const query = `SELECT s.* EXCEPT(store_registerDate, store_dispensary_id, store_dispensary_name)
                 FROM ${keyDatasetId}.${keyStoresTableId} AS s
                 WHERE s.store_id = '${storeId}' 
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
      message: 'Store Profile Successfuly',
      data: {
        store: rows[0],
      }
    }
  } else {
    return {
      error: false,
      message: 'Store Profile does not exist',
      data: {
        store: [],
      }
    }
  }
}

async function addStoreDispensaryProfile(dispensaryId, store) {

  // Data
  var photosData = []
  if (store['store_photos']) {
    store['store_photos'].forEach(photo => photosData.push(`STRUCT('${photo['photo_url']}')`));
  }

  var hoursData = []
  if (store['store_hours']) {
    store['store_hours'].forEach(hours => {
      let date = new Date();
      let date_now = date.getMonth() + "/" + date.getDay() + "/" + date.getFullYear()
      var timeOpen = new Date(date_now+ " " +hours['opensAt'])
      var timeClose = new Date(date_now+ " " +hours['closesAt'])
      hoursData.push(`('${hours['day']}',
                       PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${timeOpen.toUTCString()}'),
                       PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${timeClose.toUTCString()}')
                      )`)
    });
  }

  // Query
  const query = `INSERT ${keyDatasetId}.${keyStoresTableId} (
                  store_id,
                  store_name,
                  store_photos,
                  store_description,
                  store_addressLine1,
                  store_addressLine2,
                  store_city,
                  store_state,
                  store_zip,
                  store_hours,
                  store_phone,
                  store_email,
                  store_website,
                  store_facebook,
                  store_instagram,
                  store_twitter,
                  store_youtube,
                  store_main,
                  store_available,
                  store_registerDate,
                  store_dispensary_id,
                  store_dispensary_name
                  )
                VALUES (
                  GENERATE_UUID(),
                  '${store['store_name']}',
                  [${photosData.toString()}],
                  '${store['store_description']}',
                  '${store['store_addressLine1']}',
                  '${store['store_addressLine2']}',
                  '${store['store_city']}',
                  '${store['store_state']}',
                  '${store['store_zip']}',
                  [${hoursData.toString()}],
                  '${store['store_phone']}',
                  '${store['store_email']}',
                  '${store['store_website']}',
                  '${store['store_facebook']}',
                  '${store['store_instagram']}',
                  '${store['store_twitter']}',
                  '${store['store_youtube']}',
                  ${store['store_main']},
                  ${store['store_available']},
                  CURRENT_DATETIME(),
                  '${store['store_dispensary_id']}',
                  '${store['store_dispensary_name']}'
                  )
                `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    const query = `SELECT store_id
                   FROM ${keyDatasetId}.${keyStoresTableId} AS s
                   WHERE s.store_name = '${store['store_name']}' AND s.store_main = ${store['store_main']}
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {

      // Query
      const query = `UPDATE ${keyDatasetId}.${keyDispensariesTableId} AS d
                     SET d.dispensary_stores = ARRAY_CONCAT(d.dispensary_stores ,[STRUCT('${rows[0]['store_id']}')])
                     WHERE d.dispensary_id = '${dispensaryId}'`;

      const options = {
        query: query,
        location: 'US',
      };

      const [rowsfinal] = await bigquery.query(options);

      if (rowsfinal) {
        return {
          error: false,
          message: 'Add Store in dispensary successfuly',
          data: {
            store_id: rows[0]['store_id']
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Add Store in dispensary',
        }
      }

    } else {
      return {
        error: true,
        message: 'Error Add Store in dispensary',
      }
    }
  } else {
    return {
      error: true,
      message: 'Error Add Store in dispensary',
    }
  }
}

async function updateStoreDispensaryProfile(storeId, update) {

  const updateData = [];

  if (update['store_name']) {
    updateData.push(`s.store_name = '${update['store_name']}'`)
  }

  if (update['store_photos']) {
    var photosData = []
    update['store_photos'].forEach(photo => photosData.push(`STRUCT('${photo['photo_url']}')`));

    updateData.push(`s.store_photos = [${photosData.toString()}]`)
  }

  if (update['store_description']) {
    updateData.push(`s.store_description = '${update['store_description']}'`)
  }

  if (update['store_addressLine1']) {
    updateData.push(`s.store_addressLine1 = '${update['store_addressLine1']}'`)
  }

  if (update['store_addressLine2']) {
    updateData.push(`s.store_addressLine2 = '${update['store_addressLine2']}'`)
  }

  if (update['store_city']) {
    updateData.push(`s.store_city = '${update['store_city']}'`)
  }

  if (update['store_state']) {
    updateData.push(`s.store_state = '${update['store_state']}'`)
  }

  if (update['store_zip']) {
    updateData.push(`s.store_zip = '${update['store_zip']}'`)
  }

  if (update['store_hours']) {

    var hoursData = []
    update['store_hours'].forEach(hours => {
      let date = new Date();
      let date_now = date.getMonth() + "/" + date.getDay() + "/" + date.getFullYear()
      var timeOpen = new Date(date_now+ " " +hours['opensAt'])
      var timeClose = new Date(date_now+ " " +hours['closesAt'])
      hoursData.push(`('${hours['day']}',
                       PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${timeOpen.toUTCString()}'),
                       PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${timeClose.toUTCString()}')
                      )`)
    });

    updateData.push(`s.store_hours = [${hoursData.toString()}]`)
  }

  if (update['store_phone']) {
    updateData.push(`s.store_phone = '${update['store_phone']}'`)
  }

  if (update['store_email']) {
    updateData.push(`s.store_email = '${update['store_email']}'`)
  }

  if (update['store_website']) {
    updateData.push(`s.store_website = '${update['store_website']}'`)
  }

  if (update['store_facebook']) {
    updateData.push(`s.store_facebook = '${update['store_facebook']}'`)
  }

  if (update['store_instagram']) {
    updateData.push(`s.store_instagram = '${update['store_instagram']}'`)
  }

  if (update['store_twitter']) {
    updateData.push(`s.store_twitter = '${update['store_twitter']}'`)
  }

  if (update['store_youtube']) {
    updateData.push(`s.store_youtube = '${update['store_youtube']}'`)
  }

  if (update['store_available'] !== undefined){
    updateData.push(`s.store_available = ${update['store_available']}`)
  }

  console.log(updateData)

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyStoresTableId} AS s
                 SET ${updateData}
                 WHERE s.store_id = '${storeId}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {

    // Query   
    const query = `SELECT s.*
                   FROM ${keyDatasetId}.${keyStoresTableId}  AS s
                   WHERE s.store_id = '${storeId}' 
                  `;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rowsStore] = await bigquery.query(options);

    if (rowsStore.length > 0) {

      return {
        error: false,
        message: 'Update Store Dispensary Profile Successfuly',
        data: {
          store: rowsStore[0],
        }
      }
    }


  } else {
    return {
      error: true,
      message: 'Error Update Store Dispensary Profile',
    }
  }

}

async function listStoreDispensaryProfile(dispensaryId) {

  // Query   
  const query = `SELECT s.store_id, s.store_name, s.store_photos, s.store_addressLine1, s.store_city, s.store_state
                 FROM ${keyDatasetId}.${keyStoresTableId} AS s
                 WHERE s.store_dispensary_id = '${dispensaryId}'  
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
      message: 'Store List Successfuly',
      data: {
        stores: rows,
      }
    }
  } else {
    return {
      error: false,
      message: 'Store list does not exist',
      data: {
        stores: [],
      }
    }
  }
}

async function deleteStoreDispensaryProfile(storeId) {

  // Query   
  const query = `DELETE ${keyDatasetId}.${keyStoresTableId} AS s
                 WHERE s.store_id = '${storeId}'
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
      message: 'Store Profile Delete Successfuly',
      data: {
        store: [],
      }
    }
  } else {
    return {
      error: false,
      message: 'Store Profile does not exist',
      data: {
        store: [],
      }
    }
  }
}

// Seconday Accounts
async function addAccountDispensaryProfile(dispensaryId, account) {

  // Data
  const salt = await bcrypt.genSalt(10)
  const encryptPassword = await bcrypt.hash(account['dispensary_account_password'], salt)
  // Query
  const query = `INSERT ${keyDatasetId}.${keyAccountsTableId} (
                  dispensary_id,
                  dispensary_account_id,
                  dispensary_account_email,
                  dispensary_account_fullname,
                  dispensary_account_password,
                  dispensary_account_store,
                  dispensary_account_available,
                  dispensary_account_signupDate,
                  dispensary_account_lastLogin,
                  dispensary_account_ownerApp
                  )
                VALUES (
                  '${account['dispensary_id']}',
                  GENERATE_UUID(),
                  '${account['dispensary_account_email']}',
                  '${account['dispensary_account_fullname']}',
                  '${encryptPassword}',
                  '${account['dispensary_account_store']}',
                  ${account['dispensary_account_available']},
                  CURRENT_DATETIME(),
                  CURRENT_DATETIME(),
                  '${account['dispensary_account_ownerApp']}'
                  )
                `;
  console.log(query)
  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    const query = `SELECT dispensary_account_id
                   FROM ${keyDatasetId}.${keyAccountsTableId} AS a
                   WHERE a.dispensary_account_email = '${account['dispensary_account_email']}'
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {

      // Query
      const query = `UPDATE ${keyDatasetId}.${keyDispensariesTableId} AS d
                     SET d.dispensary_accounts = ARRAY_CONCAT(d.dispensary_accounts ,[STRUCT('${rows[0]['dispensary_account_id']}')])
                     WHERE d.dispensary_id = '${dispensaryId}'`;

      const options = {
        query: query,
        location: 'US',
      };

      const [rowsfinal] = await bigquery.query(options);

      if (rowsfinal) {
        return {
          error: false,
          message: 'Add Secondary Account for dispensary successfuly',
          data: {
            dispensary_account_id: rows[0]['dispensary_account_id']
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Add Secondary account for dispensary',
        }
      }

    } else {
      return {
        error: true,
        message: 'Error Add Secondary account for dispensary',
      }
    }
  } else {
    return {
      error: true,
      message: 'Error Add Secondary account for dispensary',
    }
  }
}

async function updateAccountDispensaryProfile(accountId, update) {

  const updateData = [];

  if (update['dispensary_account_fullname']) {
    updateData.push(`a.dispensary_account_fullname = '${update['dispensary_account_fullname']}'`)
  }
  
  if (update['dispensary_account_store']) {
    updateData.push(`a.dispensary_account_store = '${update['dispensary_account_store']}'`)
  }
  
  if (update['dispensary_account_available'] !== undefined){
    updateData.push(`a.dispensary_account_available = ${update['dispensary_account_available']}`)
  }

  console.log(updateData)

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyAccountsTableId} AS a
                 SET ${updateData}
                 WHERE a.dispensary_account_id = '${accountId}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {

    // Query   
    const query = `SELECT a.*
                   FROM ${keyDatasetId}.${keyAccountsTableId} AS a
                   WHERE a.dispensary_account_id = '${accountId}'
                   LIMIT 1
                  `;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rowsAccount] = await bigquery.query(options);

    if (rowsAccount.length > 0) {

      return {
        error: false,
        message: 'Update Acconut secondary Successfuly',
        data: {
          account: rowsAccount[0],
        }
      }
    }


  } else {
    return {
      error: true,
      message: 'Error Update Account secondary',
    }
  }

}

async function dataAccountDispensaryProfile(dispensaryId, accountId) {

  // Query   
  const query = `CREATE TEMP FUNCTION store_info(dispensaryID STRING) AS (
                  (
                    SELECT AS STRUCT s.store_id, s.store_name, s.store_addressLine1, s.store_city, s.store_state, store_available
                    FROM ${keyDatasetId}.${keyStoresTableId} AS s
                    WHERE s.store_id = dispensaryID  
                  )
                 );
  
                 SELECT a.* EXCEPT(dispensary_account_password, dispensary_account_store, dispensary_account_signupDate, dispensary_account_lastLogin, dispensary_account_ownerApp),
                 store_info(a.dispensary_account_store) as dispensary_account_store
                 FROM ${keyDatasetId}.${keyAccountsTableId} AS a
                 WHERE a.dispensary_id = '${dispensaryId}' AND a.dispensary_account_id = '${accountId}'
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
      message: 'Dispensary Data Successfuly',
      data: {
        dispensary: rows[0],
      }
    }
  } else {
    return {
      error: false,
      message: 'Dispensaries Data does not exist',
      data: {
        dispensaries: [],
      }
    }
  }
}

async function deleteAccountDispensaryProfile(accountId) {

  // Query   
  const query = `DELETE ${keyDatasetId}.${keyAccountsTableId} AS a
                 WHERE a.dispensary_account_id = '${accountId}'
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
      message: 'Dispensary Account Delete Successfuly',
      data: {
        account: [],
      }
    }
  } else {
    return {
      error: false,
      message: 'Dispensaries Account does not exist',
      data: {
        account: [],
      }
    }
  }
}

//
//
//
async function loadDispensaryList(consumerid) {

  // Query   
  // const query = `CREATE TEMP FUNCTION consumer_dispensaries_favorites(consumerID STRING) AS (
  //                    (
  //                       SELECT ARRAY(
  //                         SELECT dispensary
  //                         FROM UNNEST(f.dispensary_list) as dispensary
  //                         WHERE dispensary.active = TRUE
  //                       ) AS dispensaries
  //                       FROM ${keyDatasetId}.${keyDispensariesFavoritesTableId} AS f
  //                       WHERE f.consumer_id = consumerID
  //                    )
  //                 );

  //                 CREATE TEMP FUNCTION dispensary_rating_list(dispensaryID STRING) AS (
  //                     (
  //                       SELECT r.dispensary_ratings AS dispensary_ratings,
  //                       FROM ${keyDatasetId}.${keyDispensariesRatingsTableId} AS r
  //                       WHERE r.dispensary_id = dispensaryID                         
  //                     )
  //                 );

  //                 SELECT d.*, d.dispensary_id IN UNNEST(consumer_dispensaries_favorites('${consumerid}').dispensary_id) AS favorite,
  //                 ROUND(IFNULL((SELECT AVG(x.rating) FROM UNNEST(dispensary_rating_list(d.dispensary_id)) as x), 0), 1) AS rating
  //                 FROM ${keyDatasetId}.${keyDispensariesTableId} AS d`;

  const query = ` SELECT s.*
                FROM ${keyDatasetId}.${keyStoresTableId} AS s`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Dispensary List Successfuly',
      data: {
        dispensaries: [],//rows,
      }
    }
  } else {
    return {
      error: false,
      message: 'Dispensaries does not exist',
      data: {
        dispensaries: [],
      }
    }
  }
}

async function loadDispensaryId(dispensaryid, consumerid) {

  // Query
  const query = `CREATE TEMP FUNCTION consumer_dispensaries_favorites(consumerID STRING) AS (
                     (
                       SELECT ARRAY(
                         SELECT dispensary
                         FROM UNNEST(f.dispensary_list) as dispensary
                         WHERE dispensary.active = TRUE
                       ) AS dispensaries
                       FROM ${keyDatasetId}.${keyDispensariesFavoritesTableId} AS f
                       WHERE f.consumer_id = consumerID
                     )
                 );

                 CREATE TEMP FUNCTION dispensary_rating(dispensaryID STRING) AS (
                     (
                       SELECT AVG(x.rating) AS rating FROM (
                                                          SELECT r.dispensary_ratings AS ratings,
                                                          FROM ${keyDatasetId}.${keyDispensariesRatingsTableId} AS r
                                                          WHERE r.dispensary_id = dispensaryID
                                                         ), UNNEST(ratings) as x
                     )
                  );

                  SELECT d.*, d.dispensary_id IN UNNEST(consumer_dispensaries_favorites('${consumerid}').dispensary_id) AS favorite,
                  ROUND(IFNULL(dispensary_rating('${dispensaryid}'), 0), 1) AS rating 
                  FROM ${keyDatasetId}.${keyDispensariesTableId} AS d
                  WHERE d.dispensary_id = '${dispensaryid}'
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
      message: 'Dispensary Successfuly',
      data: {
        dispensary: rows[0],
      }
    }
  } else {
    return {
      error: true,
      message: 'Load Dispensary Error',
    }
  }
}

// Favorites
async function setDispensaryFavorite(consumerid, dispensaryid, active) {

  // Query
  const query = `SELECT d.consumer_id
                 FROM ${keyDatasetId}.${keyDispensariesFavoritesTableId} AS d
                 WHERE d.consumer_id = '${consumerid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {

    //
    // Dispensary Favorite Exists 
    //

    // Query
    const query = ` WITH data AS (
                                  SELECT d.dispensary_list AS dispensaries_list,
                                  FROM ${keyDatasetId}.${keyDispensariesFavoritesTableId} AS d
                                  WHERE d.consumer_id = '${consumerid}'
                                  )
                    SELECT list.dispensary_id
                    FROM data, UNNEST (dispensaries_list) as list
                    WHERE list.dispensary_id = '${dispensaryid}'
                  `;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      //
      // Dispensary_ID Exists 
      //

      // Query
      const query = `CREATE TEMP FUNCTION consumer_dispensaries_favorites(consumerID STRING) AS (
                      (
                          SELECT f.dispensary_list AS dispensaries_list,
                          FROM ${keyDatasetId}.${keyDispensariesFavoritesTableId} AS f
                          WHERE f.consumer_id = consumerID                         
                      )
                    );
                    UPDATE ${keyDatasetId}.${keyDispensariesFavoritesTableId} AS f
                    SET f.dispensary_list = ARRAY(
                                            SELECT IF(list.dispensary_id = '${dispensaryid}', (list.dispensary_id , ${active} ),(list.dispensary_id , list.active ))
                                            FROM UNNEST(consumer_dispensaries_favorites('${consumerid}')) AS list
                                            )
                    WHERE f.consumer_id = '${consumerid}'`;

      const options = {
        query: query,
        location: 'US',
      };

      // Connection
      const [rows] = await bigquery.query(options);
      if (rows) {
        return {
          error: false,
          message: 'Update Favorite Dispensary',
          data: {
            favorite: active
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Update Favorite Dispensary',
        }
      }

    } else {
      //
      // Dispensary_ID Does Not Exists 
      //
      var favoriteData = []
      favoriteData.push(`STRUCT('${dispensaryid}', TRUE)`);

      // Query
      const query = `UPDATE ${keyDatasetId}.${keyDispensariesFavoritesTableId} AS d
                     SET d.dispensary_list = ARRAY_CONCAT(d.dispensary_list ,[${favoriteData.toString()}])
                     WHERE d.consumer_id = '${consumerid}'`;

      const options = {
        query: query,
        location: 'US',
      };

      // Connection
      const [rows] = await bigquery.query(options);
      console.log(rows)
      if (rows) {
        return {
          error: false,
          message: 'Set New User Dispensary Favorite Successfuly',
          data: {
            favorite: active
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Set New User Dispensary Favorite',
        }
      }
    }

  } else {

    //
    // Dispensary Favorite Does Not Exists 
    //

    var favoriteData = []
    favoriteData.push(`STRUCT('${dispensaryid}', TRUE)`);

    // Query
    const query = `INSERT ${keyDatasetId}.${keyDispensariesFavoritesTableId} (
                    consumer_id,
                    dispensary_list
                    )
                   VALUES (
                    '${consumerid}',
                    [${favoriteData.toString()}]
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
      return {
        error: false,
        message: 'New User Dispensary Favorite Successfuly',
        data: {
          favorite: active
        }
      }
    } else {
      return {
        error: true,
        message: 'Error New User Dispensary Favorite',
      }
    }
  }
}

async function loadDispensaryFavoritesList(consumerid) {

  // Query   
  const query = `CREATE TEMP FUNCTION consumer_dispensaries_favorites(consumerID STRING) AS (
                   (
                    SELECT ARRAY(
                      SELECT dispensary
                      FROM UNNEST(f.dispensary_list) as dispensary
                      WHERE dispensary.active = TRUE
                    ) AS dispensaries
                    FROM ${keyDatasetId}.${keyDispensariesFavoritesTableId} AS f
                    WHERE f.consumer_id = consumerID
                   )
                );

                CREATE TEMP FUNCTION dispensary_rating_list(dispensaryID STRING) AS (
                    (
                     SELECT r.dispensary_ratings AS dispensary_ratings,
                     FROM ${keyDatasetId}.${keyDispensariesRatingsTableId} AS r
                     WHERE r.dispensary_id = dispensaryID                         
                    )
                );

                SELECT d.*, favorites.active AS favorite,
                ROUND(IFNULL((SELECT AVG(x.rating) FROM UNNEST(dispensary_rating_list(d.dispensary_id)) as x), 0), 1) AS rating
                FROM ${keyDatasetId}.${keyDispensariesTableId} AS d, UNNEST(consumer_dispensaries_favorites('${consumerid}')) AS favorites
                WHERE d.dispensary_id = favorites.dispensary_id `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'User Favorite Dispensaries List Successfuly',
      data: {
        dispensaries: rows,
      }
    }
  } else {
    return {
      error: true,
      message: 'User Favorite Dispensaries List Does Not Exist',
      data: {
        dispensaries: [],
      }
    }
  }
}

// Rating
async function setDispensaryRating(consumerid, dispensaryid, rating) {

  // Query
  const query = `SELECT r.dispensary_id
                  FROM ${keyDatasetId}.${keyDispensariesRatingsTableId} AS r
                  WHERE r.dispensary_id = '${dispensaryid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {

    //
    // Dispensary Ratings Exists 
    //

    // Query
    const query = ` WITH data AS (
                                  SELECT r.dispensary_ratings AS dispensaries_ratings,
                                  FROM ${keyDatasetId}.${keyDispensariesRatingsTableId} AS r
                                  WHERE r.dispensary_id = '${dispensaryid}'
                                  )
                    SELECT ratings.consumer_id , ratings.rating
                    FROM data, UNNEST (dispensaries_ratings) as ratings
                    WHERE ratings.consumer_id = '${consumerid}'
                  `;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      //
      // Dispensary_Ratings_ID Exists 
      //

      // Query
      const query = `CREATE TEMP FUNCTION dispensary_rating_list(dispensaryID STRING) AS (
                                          (
                                              SELECT r.dispensary_ratings AS dispensary_ratings,
                                              FROM ${keyDatasetId}.${keyDispensariesRatingsTableId} AS r
                                              WHERE r.dispensary_id = dispensaryID                         
                                          )
                    );
                    UPDATE ${keyDatasetId}.${keyDispensariesRatingsTableId} AS r
                    SET r.dispensary_ratings = ARRAY(
                                               SELECT IF(ratings.consumer_id = '${consumerid}', (ratings.consumer_id , ${rating} ),(ratings.consumer_id  , ratings.rating ))
                                               FROM UNNEST(dispensary_rating_list('${dispensaryid}')) AS ratings
                                               )
                    WHERE r.dispensary_id = '${dispensaryid}'`;

      const options = {
        query: query,
        location: 'US',
      };

      // Connection
      const [rows] = await bigquery.query(options);
      if (rows) {
        return {
          error: false,
          message: 'Update Rating Dispensary',
          data: {
            rating: rating
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Update Rating Dispensary',
        }
      }

    } else {
      //
      // Dispensary_ID Does Not Exists 
      //

      var ratingData = []
      ratingData.push(`STRUCT('${consumerid}', ${rating})`);

      // Query
      const query = `UPDATE ${keyDatasetId}.${keyDispensariesRatingsTableId} AS r
                     SET r.dispensary_ratings = ARRAY_CONCAT(r.dispensary_ratings ,[${ratingData.toString()}])
                     WHERE r.dispensary_id = '${dispensaryid}'`;

      const options = {
        query: query,
        location: 'US',
      };

      // Connection
      const [rows] = await bigquery.query(options);
      console.log(rows)
      if (rows) {
        return {
          error: false,
          message: 'Set New Rating Dispensary Successfuly',
          data: {
            rating: rating
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Set New Rating Dispensary',
        }
      }
    }


  } else {

    //
    // Dispensary Ratings Does Not Exists 
    //

    var ratingData = []
    ratingData.push(`STRUCT('${consumerid}', ${rating})`);

    // Query
    const query = `INSERT ${keyDatasetId}.${keyDispensariesRatingsTableId} (
                    dispensary_id,
                    dispensary_ratings
                    )
                   VALUES (
                    '${dispensaryid}',
                    [${ratingData.toString()}]
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
      return {
        error: false,
        message: 'New Rating Dispensary Successfuly',
        data: {
          rating: rating
        }
      }
    } else {
      return {
        error: true,
        message: 'Error New Rating Dispensary',
      }
    }
  }
}

module.exports = {
  //Dashboard
  dataDispensaryDashboard,
  // Dispensary
  dataDispensaryProfile,
  updateDispensaryProfile,
  // Store
  getStoreDispensaryProfile,
  addStoreDispensaryProfile,
  updateStoreDispensaryProfile,
  listStoreDispensaryProfile,
  deleteStoreDispensaryProfile,
  // Secondary Accounts
  addAccountDispensaryProfile,
  updateAccountDispensaryProfile,
  dataAccountDispensaryProfile,
  deleteAccountDispensaryProfile,
  //
  loadDispensaryList,
  loadDispensaryId,
  setDispensaryFavorite,
  loadDispensaryFavoritesList,
  setDispensaryRating,
}