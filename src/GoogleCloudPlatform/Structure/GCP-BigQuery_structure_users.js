
const userSchema = require('../Models/user/user.model');
const userStoreFavoritesSchema = require('../Models/user/user_store_favorites.model')

async function setUsersTables(BigQueryConnection, keyDatasetId) {

  setUsersDataTable(BigQueryConnection,keyDatasetId)
  setUsersDispensaryFavoritesDataTable(BigQueryConnection, keyDatasetId)
                          
}

async function setUsersDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_users_data";

  const options = {
    schema: userSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

async function setUsersDispensaryFavoritesDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_users_stores_favorites_data";

  const options = {
    schema: userStoreFavoritesSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

module.exports = {
  setUsersTables
}