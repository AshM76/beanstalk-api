
const dealsSchema = require('../Models/deals/deals.model');

async function setDealsTables(BigQueryConnection, keyDatasetId) {

  setDealsDataTable(BigQueryConnection,keyDatasetId)
                          
}

async function setDealsDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_deals_data";

  const options = {
    schema: dealsSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

module.exports = {
  setDealsTables
}