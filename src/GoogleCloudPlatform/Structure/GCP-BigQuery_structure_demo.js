
const demoSchema = require('../Models/demo/demo.model');

async function setDemoTables(BigQueryConnection, keyDatasetId) {

  setDemoDataTable(BigQueryConnection,keyDatasetId)
                  
}

async function setDemoDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_demo_data";

  const options = {
    schema: demoSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

module.exports = {
  setDemoTables
}