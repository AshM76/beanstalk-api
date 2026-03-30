
const { BigQuery } = require('@google-cloud/bigquery');

const bcrypt = require('bcryptjs');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyStoreTableId = "beanstalk_stores_data";
//
const keyStoreFavoritesTableId = "beanstalk_users_stores_favorites_data";
const keyStoreRatingTableId = "beanstalk_stores_ratings_data";
//
const keyDealTableId = "beanstalk_deals_data";


//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

// WEB
async function createStore(store) {

  // Data
  var photosData = []

  // Query
  const query = `INSERT ${keyDatasetId}.${keyTableId} (
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
                  '${store['store_addressline1']}',
                  '${store['store_addressline2']}',
                  '${store['store_city']}',
                  '${store['store_state']}',
                  '${store['store_zip']}',
                  '${store['store_hours']}',
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
                  '${deal['store_dispensary_id']}',
                  '${deal['store_dispensary_name']}'
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
                   FROM ${keyDatasetId}.${keyTableId} AS s
                   WHERE s.store_name = '${store['store_name']}' AND s.store_main = 1
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      return {
        error: false,
        message: 'Store create successfuly',
        data: {
          store_id: rows[0]['store_id']
        }
      }
    } else {
      return {
        error: true,
        message: 'Store create error',
      }
    }
  } else {
    return {
      error: true,
      message: 'Store create error',
    }
  }
}

// MOBILE
async function loadStoreList(consumerid) {

  // Query   
  const query = `CREATE TEMP FUNCTION consumer_stores_favorites(consumerID STRING) AS (
                    (
                        SELECT ARRAY(
                            SELECT store
                            FROM UNNEST(f.store_list) as store
                            WHERE store.active = TRUE
                        ) AS stores
                        FROM ${keyDatasetId}.${keyStoreFavoritesTableId}  AS f
                        WHERE f.consumer_id = consumerID
                    )
                  );

                  CREATE TEMP FUNCTION store_rating_list(storeID STRING) AS (
                    (
                        SELECT r.store_ratings AS store_ratings,
                        FROM ${keyDatasetId}.${keyStoreRatingTableId} AS r
                        WHERE r.store_id = storeID                         
                    )
                  );

                  SELECT s.*, s.store_id IN UNNEST(consumer_stores_favorites('${consumerid}').store_id) AS favorite,
                  IFNULL((SELECT AVG(x.rating) FROM UNNEST(store_rating_list(s.store_id)) as x), 0) AS rating 
                  FROM ${keyDatasetId}.${keyStoreTableId} AS s
                  WHERE s.store_available = TRUE
                  ORDER BY favorite DESC, INITCAP(s.store_name) ASC;
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
      message: 'Stores List Successfuly',
      data: {
        stores: rows,
      }
    }
  } else {
    return {
      error: false,
      message: 'Stores does not exist',
      data: {
        stores: [],
      }
    }
  }
}

async function loadStoreListSearch(consumerid, search) {

  // Query   
  const query = `CREATE TEMP FUNCTION consumer_stores_favorites(consumerID STRING) AS (
                    (
                        SELECT ARRAY(
                            SELECT store
                            FROM UNNEST(f.store_list) as store
                            WHERE store.active = TRUE
                        ) AS stores
                        FROM ${keyDatasetId}.${keyStoreFavoritesTableId}  AS f
                        WHERE f.consumer_id = consumerID
                    )
                  );

                  CREATE TEMP FUNCTION store_rating_list(storeID STRING) AS (
                    (
                        SELECT r.store_ratings AS store_ratings,
                        FROM ${keyDatasetId}.${keyStoreRatingTableId} AS r
                        WHERE r.store_id = storeID                         
                    )
                  );

                  SELECT s.*, s.store_id IN UNNEST(consumer_stores_favorites('${consumerid}').store_id) AS favorite,
                  IFNULL((SELECT AVG(x.rating) FROM UNNEST(store_rating_list(s.store_id)) as x), 0) AS rating 
                  FROM ${keyDatasetId}.${keyStoreTableId} AS s
                  WHERE s.store_available = TRUE AND CONTAINS_SUBSTR(s.store_name, '${search}')
                  ORDER BY favorite DESC, INITCAP(s.store_name) ASC;
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
      message: 'Stores List Successfuly',
      data: {
        stores: rows,
      }
    }
  } else {
    return {
      error: false,
      message: 'Stores does not exist',
      data: {
        stores: [],
      }
    }
  }
}

async function loadStoreInfo(storeid, consumerid) {

  // Query
  const query = `CREATE TEMP FUNCTION consumer_stores_favorites(consumerID STRING) AS (
                  (
                      SELECT ARRAY(
                          SELECT store
                          FROM UNNEST(f.store_list) as store
                          WHERE store.active = TRUE
                      ) AS stores
                      FROM ${keyDatasetId}.${keyStoreFavoritesTableId} AS f
                      WHERE f.consumer_id = consumerID
                  )
                 );

                 CREATE TEMP FUNCTION store_rating(storeID STRING) AS (
                  (
                      SELECT AVG(x.rating) AS rating 
                      FROM (
                              SELECT r.store_ratings AS ratings,
                              FROM ${keyDatasetId}.${keyStoreRatingTableId} AS r
                              WHERE r.store_id = storeID
                      ), UNNEST(ratings) as x
                  ));

                  CREATE TEMP FUNCTION deals_list(storeID STRING) AS (
                    (
                        ARRAY(
                            SELECT AS STRUCT d.deal_id, d.deal_title, d.deal_imageURL, d.deal_typeOfDeal, d.deal_amount, d.deal_offer
                            FROM ${keyDatasetId}.${keyDealTableId} AS d
                            WHERE storeID IN UNNEST(d.deal_stores_availables.store_id) AND d.deal_status = 'published'
                        )                     
                  ));
                  
                  SELECT s.*, s.store_id IN UNNEST(consumer_stores_favorites('${consumerid}').store_id) AS favorite,
                  IFNULL(store_rating('${storeid}'), 0) AS rating,
                  deals_list('${storeid}') AS store_deals
                  FROM ${keyDatasetId}.${keyStoreTableId} AS s
                  WHERE s.store_id = '${storeid}' AND s.store_available = TRUE
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
      message: 'Store info Successfuly',
      data: {
        store: rows[0],
      }
    }
  } else {
    return {
      error: true,
      message: 'Store does not exist',
    }
  }
}

// Favorites
async function setStoreFavorites(consumerid, storeid, active) {

  // Query
  const query = `SELECT s.consumer_id
                 FROM ${keyDatasetId}.${keyStoreFavoritesTableId} AS s
                 WHERE s.consumer_id = '${consumerid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {

    //
    // Store Favorite Exists 
    //

    // Query
    const query = ` WITH data AS (
                                  SELECT s.store_list AS store_list,
                                  FROM ${keyDatasetId}.${keyStoreFavoritesTableId} AS s
                                  WHERE s.consumer_id = '${consumerid}'
                                  )
                    SELECT list.store_id
                    FROM data, UNNEST (store_list) as list
                    WHERE list.store_id = '${storeid}'
                  `;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      //
      // Store_ID Exists 
      //

      // Query
      const query = `CREATE TEMP FUNCTION consumer_stores_favorites(consumerID STRING) AS (
                      (
                          SELECT f.store_list AS store_list,
                          FROM ${keyDatasetId}.${keyStoreFavoritesTableId} AS f
                          WHERE f.consumer_id = consumerID
                      )
                     );

                    UPDATE ${keyDatasetId}.${keyStoreFavoritesTableId} AS f
                    SET f.store_list = ARRAY(
                                            SELECT IF(list.store_id = '${storeid}', (list.store_id , ${active} ),(list.store_id , list.active ))
                                            FROM UNNEST(consumer_stores_favorites('${consumerid}')) AS list
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
          message: 'Update Favorite Store',
          data: {
            favorite: active
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Update Favorite Store',
        }
      }

    } else {
      //
      // Store_ID Does Not Exists 
      //
      var favoriteData = []
      favoriteData.push(`STRUCT('${storeid}', TRUE)`);

      // Query
      const query = `UPDATE ${keyDatasetId}.${keyStoreFavoritesTableId} AS s
                     SET s.store_list = ARRAY_CONCAT(s.store_list ,[${favoriteData.toString()}])
                     WHERE s.consumer_id = '${consumerid}'`;

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
          message: 'Set New User Store Favorite Successfuly',
          data: {
            favorite: active
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Set New User Store Favorite',
        }
      }
    }

  } else {

    //
    // Store Favorite Does Not Exists 
    //

    var storeData = []
    storeData.push(`STRUCT('${storeid}', TRUE)`);

    // Query
    const query = `INSERT ${keyDatasetId}.${keyStoreFavoritesTableId} (
                    consumer_id,
                    store_list
                    )
                   VALUES (
                    '${consumerid}',
                    [${storeData.toString()}]
                    )
                  `;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);
    if (rows) {
      return {
        error: false,
        message: 'New User Store Favorite Successfuly',
        data: {
          favorite: active
        }
      }
    } else {
      return {
        error: true,
        message: 'Error New User Store Favorite',
      }
    }
  }
}

async function loadStoreFavoritesList(consumerid) {

  // Query   
  const query = `CREATE TEMP FUNCTION consumer_stores_favorites(consumerID STRING) AS (
                  (
                      SELECT ARRAY(
                          SELECT store
                          FROM UNNEST(f.store_list) as store
                          WHERE store.active = TRUE
                      ) AS stores
                      FROM ${keyDatasetId}.${keyStoreFavoritesTableId} AS f
                      WHERE f.consumer_id = consumerID
                  )
                );

                CREATE TEMP FUNCTION store_rating_list(storeID STRING) AS (
                  (
                      SELECT r.store_ratings AS store_ratings,
                      FROM ${keyDatasetId}.${keyStoreRatingTableId} AS r
                      WHERE r.store_id = storeID                         
                  )
                );
                
                SELECT s.*, favorites.active AS favorite,
                IFNULL((SELECT AVG(x.rating) FROM UNNEST(store_rating_list(s.store_id)) as x), 0) AS rating 
                FROM ${keyDatasetId}.${keyStoreTableId} AS s, UNNEST(consumer_stores_favorites('${consumerid}')) AS favorites
                WHERE s.store_id = favorites.store_id AND s.store_available = TRUE `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'User Store Favorites List Successfuly',
      data: {
        stores: rows,
      }
    }
  } else {
    return {
      error: true,
      message: 'User Store Favorites List Does Not Exist',
      data: {
        stores: [],
      }
    }
  }
}

// Rating
async function setStoreRating(consumerid, storeid, rating) {

  // Query
  const query = `SELECT r.store_id
                 FROM ${keyDatasetId}.${keyStoreRatingTableId} AS r
                 WHERE r.store_id = '${storeid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {

    //
    // Store Ratings Exists 
    //

    // Query
    const query = ` WITH data AS (
                                  SELECT r.store_ratings AS store_ratings,
                                  FROM ${keyDatasetId}.${keyStoreRatingTableId} AS r
                                  WHERE r.store_id = '${storeid}'
                                  )
                    SELECT ratings.consumer_id , ratings.rating
                    FROM data, UNNEST (store_ratings) as ratings
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
      // Store_Ratings_ID Exists 
      //

      // Query
      const query = `CREATE TEMP FUNCTION store_rating_list(storeID STRING) AS (
                      (
                          SELECT r.store_ratings AS store_ratings,
                          FROM ${keyDatasetId}.${keyStoreRatingTableId} AS r
                          WHERE r.store_id = storeID                         
                      )
                    );
                    UPDATE ${keyDatasetId}.${keyStoreRatingTableId} AS r
                    SET r.store_ratings = ARRAY(
                                               SELECT IF(ratings.consumer_id = '${consumerid}', (ratings.consumer_id , ${rating} ),(ratings.consumer_id  , ratings.rating ))
                                               FROM UNNEST(store_rating_list('${storeid}')) AS ratings
                                               )
                    WHERE r.store_id = '${storeid}'`;

      const options = {
        query: query,
        location: 'US',
      };

      // Connection
      const [rows] = await bigquery.query(options);
      if (rows) {
        return {
          error: false,
          message: 'Update Rating Store',
          data: {
            rating: rating
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Update Rating Store',
        }
      }

    } else {
      //
      // Store_ID Does Not Exists 
      //

      var ratingData = []
      ratingData.push(`STRUCT('${consumerid}', ${rating})`);

      // Query
      const query = `UPDATE ${keyDatasetId}.${keyStoreRatingTableId} AS r
                     SET r.store_ratings = ARRAY_CONCAT(r.store_ratings ,[${ratingData.toString()}])
                     WHERE r.store_id = '${storeid}'`;

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
          message: 'Set New Rating Store Successfuly',
          data: {
            rating: rating
          }
        }
      } else {
        return {
          error: true,
          message: 'Error Set New Rating Store',
        }
      }
    }


  } else {

    //
    // Store Ratings Does Not Exists 
    //

    var ratingData = []
    ratingData.push(`STRUCT('${consumerid}', ${rating})`);

    // Query
    const query = `INSERT ${keyDatasetId}.${keyStoreRatingTableId} (
                    store_id,
                    store_ratings
                    )
                   VALUES (
                    '${storeid}',
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
        message: 'New Rating Store Successfuly',
        data: {
          rating: rating
        }
      }
    } else {
      return {
        error: true,
        message: 'Error New Rating Store',
      }
    }
  }
}


module.exports = {
  // WEB
  createStore,
  // MOBILE
  loadStoreList,
  loadStoreListSearch,
  loadStoreInfo,
  setStoreFavorites,
  loadStoreFavoritesList,
  setStoreRating
}