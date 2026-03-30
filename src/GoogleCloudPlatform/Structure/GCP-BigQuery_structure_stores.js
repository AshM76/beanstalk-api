
const storeSchema = require('../Models/store/store.model');
const storeRatingsSchema = require('../Models/store/store_ratings.model')

async function setStoresTables(BigQueryConnection, keyDatasetId) {

  setStoresDataTable(BigQueryConnection,keyDatasetId)
  setStoresFavoritesDataTable(BigQueryConnection,keyDatasetId)

}

async function setStoresDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_stores_data";

  const options = {
    schema: storeSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

async function setStoresFavoritesDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_stores_ratings_data";

  const options = {
    schema: storeRatingsSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

module.exports = {
  setStoresTables
} 