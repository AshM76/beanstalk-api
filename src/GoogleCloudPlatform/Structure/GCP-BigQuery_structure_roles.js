
const rolesSchema = require('../Models/roles/roles.model');

async function setRolesTables(BigQueryConnection, keyDatasetId) {

  setRolesDataTable(BigQueryConnection,keyDatasetId)
                          
}

async function setRolesDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_roles_data";

  const options = {
    schema: rolesSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

module.exports = {
  setRolesTables
}