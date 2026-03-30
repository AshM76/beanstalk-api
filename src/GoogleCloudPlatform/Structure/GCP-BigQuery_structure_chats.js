
const chatSchema = require('../Models/chat/chat.model');

async function setChatsTables(BigQueryConnection, keyDatasetId) {

  setChatsDataTable(BigQueryConnection,keyDatasetId)
                          
}

async function setChatsDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_chats_data";

  const options = {
    schema: chatSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

}

module.exports = {
  setChatsTables
}