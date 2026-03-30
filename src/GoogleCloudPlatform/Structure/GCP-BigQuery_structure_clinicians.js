
const cliniciansSchema = require('../Models/clinicians/clinicians.model');

async function setCliniciansTables(BigQueryConnection, keyDatasetId) {

  setCliniciansDataTable(BigQueryConnection,keyDatasetId)
                          
}

async function setCliniciansDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_clinicians_data";

  const options = {
    schema: cliniciansSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

module.exports = {
  setCliniciansTables
}