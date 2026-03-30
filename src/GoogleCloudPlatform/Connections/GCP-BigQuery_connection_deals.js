const { BigQuery } = require('@google-cloud/bigquery');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = "beanstalk_deals_data";
//
const keyDealTableId = "beanstalk_deals_data";
//
const keyStoreTableId = "beanstalk_stores_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

//WEB: Deal List
async function loadDealListByDispensaryId(dispensaryid) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS d
                 WHERE d.deal_dispensary_id = '${dispensaryid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Deals List Successfuly',
      data: {
        deals: rows,
      }
    }
  } else {
    return {
      error: false,
      message: 'Deals does not exist',
    }
  }
}

//WEB: Deal Detail
async function loadDealDetailById(dealid) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS d
                 WHERE d.deal_id = '${dealid}'
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
      message: 'Deal Successfuly',
      data: {
        deal: rows[0],
      }
    }

  } else {
    return {
      error: true,
      message: 'Load Deal Error',
    }
  }
}

//WEB: Deal Create
async function createDeal(deal) {

  var storesAvailablesData = [];
  if (deal['deal_stores_availables']) {
    deal['deal_stores_availables'].forEach(store => storesAvailablesData.push(`STRUCT('${store['store_id']}')`));
  }

  var pushNotificationDate = 'NULL';
  if (deal['deal_publish_pushDate']){
    pushNotificationDate = `PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT', '${new Date(deal['deal_publish_pushDate']).toUTCString()}')`
  }

  // Query
  const query = `INSERT ${keyDatasetId}.${keyTableId} (
                    deal_id,
                    deal_title,
                    deal_description,
                    deal_imageURL,
                    deal_typeOfDeal,
                    deal_amount,
                    deal_offer,
                    deal_typeOfProduct,
                    deal_brandOfProduct,
                    deal_rangeDeal,
                    deal_startDate,
                    deal_endDate,
                    deal_url,
                    deal_publish_pushDate,
                    deal_publish_smsDate,
                    deal_publish_emailDate,
                    deal_publish_timeZone,
                    deal_status,
                    deal_createdDate,
                    deal_dispensary_id,
                    deal_dispensary_name,
                    deal_stores_availables
                    )
                  VALUES (
                    GENERATE_UUID(),
                    '${deal['deal_title']}',
                    '${deal['deal_description']}',
                    '${deal['deal_imageURL']}',
                    '${deal['deal_typeOfDeal']}',
                    '${deal['deal_amount']}',
                    '${deal['deal_offer']}',
                    '${deal['deal_typeOfProduct']}',
                    '${deal['deal_brandOfProduct']}',
                    '${deal['deal_rangeDeal']}',
                    PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT', '${new Date(deal['deal_startDate']).toUTCString()}'),
                    PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT', '${new Date(deal['deal_endDate']).toUTCString()}'),
                    '${deal['deal_url']}',
                    ${pushNotificationDate},
                    NULL,
                    NULL,
                    '${deal['deal_publish_timeZone']}',
                    '${deal['deal_status']}',
                    CURRENT_DATETIME(),
                    '${deal['deal_dispensary_id']}',
                    '${deal['deal_dispensary_name']}',
                    [${storesAvailablesData.toString()}]
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

    const query = `SELECT deal_id
                   FROM ${keyDatasetId}.${keyTableId} AS d
                   WHERE d.deal_dispensary_id = '${deal['deal_dispensary_id']}'
                   ORDER BY d.deal_createdDate DESC
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      return {
        error: false,
        message: 'Deal Created Successfuly',
        data: {
          deal_id: rows[0]['deal_id']
        }
      }
    } else {
      return {
        error: true,
        message: 'Deal Create error',
      }
    }
  } else {
    return {
      error: true,
      message: 'Deal Create Error',
    }
  }
}

//WEB: Deal Update
async function updateDeal(dealid, update) {

  const updateData = [];

  if (update['deal_title']) {
    updateData.push(`d.deal_title = '${update['deal_title']}'`)
  }

  if (update['deal_description']) {
    updateData.push(`d.deal_description = '${update['deal_description']}'`)
  }

  if (update['deal_imageURL']) {
    updateData.push(`d.deal_imageURL = '${update['deal_imageURL']}'`)
  }

  if (update['deal_typeOfDeal']) {
    updateData.push(`d.deal_typeOfDeal = '${update['deal_typeOfDeal']}'`)
  }
  
  if (update['deal_amount']) {
    updateData.push(`d.deal_amount = '${update['deal_amount']}'`)
  }

  if (update['deal_offer']) {
    updateData.push(`d.deal_offer = '${update['deal_offer']}'`)
  }

  if (update['deal_typeOfProduct']) {
    updateData.push(`d.deal_typeOfProduct = '${update['deal_typeOfProduct']}'`)
  }

  if (update['deal_brandOfProduct']) {
    updateData.push(`d.deal_brandOfProduct = '${update['deal_brandOfProduct']}'`)
  }

  if (update['deal_rangeDeal']) {
    updateData.push(`d.deal_rangeDeal = '${update['deal_rangeDeal']}'`)
  }

  if (update['deal_startDate']) {
    var date = new Date(update['deal_startDate'])
    updateData.push(`d.deal_startDate = PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${date.toUTCString()}')`)
  }

  if (update['deal_endDate']) {
    var date = new Date(update['deal_endDate'])
    updateData.push(`d.deal_endDate = PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${date.toUTCString()}')`)
  }

  if (update['deal_url']) {
    updateData.push(`d.deal_url = '${update['deal_url']}'`)
  }

  if (update['deal_publish_pushDate']) {
    var date = new Date(update['deal_publish_pushDate'])
    updateData.push(`d.deal_publish_pushDate = PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${date.toUTCString()}')`)
  }

  if (update['deal_publish_timeZone']) {
    updateData.push(`d.deal_publish_timeZone = '${update['deal_publish_timeZone']}'`)
  }

  if (update['deal_status']) {
    updateData.push(`d.deal_status = '${update['deal_status']}'`)
  }

  if (update['deal_dispensary_id']) {
    updateData.push(`d.deal_dispensary_id = '${update['deal_dispensary_id']}'`)
  }

  if (update['deal_dispensary_name']) {
    updateData.push(`d.deal_dispensary_name = '${update['deal_dispensary_name']}'`)
  }

  if (update['deal_stores_availables']) {
    var storesAvailablesData = [];
    update['deal_stores_availables'].forEach(store => storesAvailablesData.push(`STRUCT('${store['store_id']}')`));
    updateData.push(`d.deal_stores_availables = [${storesAvailablesData.toString()}]`)
  }

  console.log(updateData)

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyTableId} AS d
                 SET ${updateData}
                 WHERE d.deal_id = '${dealid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {

    // Query
    const query = `SELECT *
                   FROM ${keyDatasetId}.${keyTableId} AS d
                   WHERE d.deal_id = '${dealid}'
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rowsDeal] = await bigquery.query(options);

    if (rowsDeal.length > 0) {

      return {
        error: false,
        message: 'Update Deal Successfuly',
        data: {
          deal: rowsDeal[0],
        }
      }
    }

  } else {
    return {
      error: true,
      message: 'Error Update Deal',
    }
  }

}

//WEB: AUTOMATIC PROCESSS Closed Deals
async function autoClosedDeals() {

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyTableId} AS d
                 SET d.deal_status = 'closed'
                 WHERE d.deal_status = 'published' AND d.deal_endDate <= CURRENT_DATETIME()`

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
      return {
        error: false,
        message: 'Closed Deals Expiration EndDate Successfuly',
      }
  } else {
    return {
      error: true,
      message: 'Error closed Deals Expiration EndDate',
    }
  }

}


//MOBILE: Deal List
async function loadDealList(userid) {

  // Query
  const query = `SELECT *
                   FROM ${keyDatasetId}.${keyTableId} AS s `;
  //    WHERE s.user_id = '${userid}'

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Deals List Successfuly',
      data: {
        deals: rows,
      }
    }
  } else {
    return {
      error: false,
      message: 'Deals does not exist',
    }
  }
}

//MOBILE: Deal Detail
async function loadDealId(dealid) {

  // Query
  const query = `CREATE TEMP FUNCTION deals_list(dispensaryID STRING, storeID STRING) AS (
                  (
                     ARRAY(
                           SELECT AS STRUCT d.deal_id, d.deal_title, d.deal_imageURL, d.deal_typeOfDeal, d.deal_amount, d.deal_offer
                           FROM ${keyDatasetId}.${keyDealTableId} AS d
                           WHERE d.deal_dispensary_id = dispensaryID AND d.deal_id != storeID AND d.deal_status = 'published'
                     )                     
                  ));
 
                  SELECT * EXCEPT(deal_stores_availables),
                  deals_list(d.deal_dispensary_id, '${dealid}') AS deal_deals,
                  ARRAY(
                           SELECT AS STRUCT s.store_id, s.store_name, s.store_addressLine1
                           FROM ${keyDatasetId}.${keyStoreTableId} AS s
                           LEFT JOIN ${keyDatasetId}.${keyDealTableId} AS d
                           ON d.deal_id = '${dealid}'
                           WHERE s.store_id IN UNNEST(d.deal_stores_availables.store_id)
                     ) AS deal_stores_availables
                  FROM ${keyDatasetId}.${keyTableId} AS d
                  WHERE d.deal_id = '${dealid}'
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
        message: 'Deal Detail Successfuly',
        data: {
          deal: rows[0],
        }
      }
  } else {
    return {
      error: true,
      message: 'Load Deal Error',
    }
  }
}

module.exports = {
  loadDealListByDispensaryId,
  loadDealDetailById,
  createDeal,
  updateDeal,
  loadDealList,
  loadDealId,
  autoClosedDeals
}