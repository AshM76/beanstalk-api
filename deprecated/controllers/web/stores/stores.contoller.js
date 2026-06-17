const BigQuery = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_stores')

//WEB: Store Create
async function createStore(req, res) {
    console.log(':: POST')
    console.log(':: WEB/SaveStore')
  
    console.log(req.body)
  
    const result = await BigQuery.createStore(req.body)
    console.log(result);
    if (result['error']) {
      return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
      return res.status(200).send({
        data: result['data'],
        error: result['error'],
        message: result['message']
      })
    }
}

module.exports = {
    createStore,
}