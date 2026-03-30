const { BigQuery } = require('@google-cloud/bigquery');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = 'beanstalk_dispensaries_inventory'

// Table
const keyTableId = "inventory_union";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

async function loadProductList(product) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS i
                 WHERE REGEXP_CONTAINS (i.product_name, r".*${product}.*")
                 LIMIT 10`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Proucts List Successfuly',
      data: {
        products: rows,
      }
    }
  } else {
    return {
      error: true,
      message: 'Products does not exist',
    }
  }
}

module.exports = {
  loadProductList
}