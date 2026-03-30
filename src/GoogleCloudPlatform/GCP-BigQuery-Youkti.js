
// Import the Google Cloud client library
const { BigQuery } = require('@google-cloud/bigquery');

const { setUsersTables } = require('./Structure/GCP-BigQuery_structure_users');
const { setSessionsTables } = require('./Structure/GCP-BigQuery_structure_sessions');
const { setDispensariesTables } = require('./Structure/GCP-BigQuery_structure_dispensaries');
const { setStoresTables } = require('./Structure/GCP-BigQuery_structure_stores');
const { setChatsTables } = require('./Structure/GCP-BigQuery_structure_chats');
const { setDealsTables } = require('./Structure/GCP-BigQuery_structure_deals')
const { setCliniciansTables } = require('./Structure/GCP-BigQuery_structure_clinicians')
const { setDemoTables } = require('./Structure/GCP-BigQuery_structure_demo')
const { setRolesTables } = require('./Structure/GCP-BigQuery_structure_roles')


const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";

async function connectBigQuery(keysGCP) {

  //Connect BigQuery Client
  const keyProjectId = keysGCP.projectId
  const keyDatasetId = keysGCP.datasetId
  const BigQueryConnection = new BigQuery({ keyProjectId, keyFilename });

  const options = {
    location: 'US',
  };

  await BigQueryConnection.createDataset(keyDatasetId, options)
                          .then(err => {
                                         console.log(`[Beanstalk] :: [GCP-BigQuery] :  Dataset [${keyDatasetId}] created successfully`)
                                         setUsersTables(BigQueryConnection, keyDatasetId)
                                         setSessionsTables(BigQueryConnection, keyDatasetId)
                                         setDispensariesTables(BigQueryConnection, keyDatasetId)
                                         setStoresTables(BigQueryConnection, keyDatasetId)
                                         setChatsTables(BigQueryConnection, keyDatasetId)
                                         setDealsTables(BigQueryConnection, keyDatasetId)
                                         setCliniciansTables(BigQueryConnection, keyDatasetId)
                                         setDemoTables(BigQueryConnection, keyDatasetId)
                                         setRolesTables(BigQueryConnection, keyDatasetId)
                          })
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Dataset [${keyDatasetId}] already exists`)})
}

module.exports = {
  connectBigQuery
}