
const dispensarySchema = require('../Models/dispensary/dispensary.model');
const dispensaryAccountsSchema = require('../Models/dispensary.accounts/dispensary.accounts.model');

async function setDispensariesTables(BigQueryConnection, keyDatasetId) {

  setDispensariesDataTable(BigQueryConnection,keyDatasetId)
  setDispensariesAccountsDataTable(BigQueryConnection,keyDatasetId)

}

async function setDispensariesDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_dispensaries_data";

  const options = {
    schema: dispensarySchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

async function setDispensariesAccountsDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_dispensaries_accounts_data";

  const options = {
    schema: dispensaryAccountsSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

module.exports = {
  setDispensariesTables
} 