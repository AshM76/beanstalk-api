// Inventory
const BigQueryInventory = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_inventory')

async function searchProductList(req, res) {
    console.log(':: GET')
    console.log(':: Inventory/SearchProductList')
    console.log(`:: product: ${req.params.product}`)
  
    let product = req.params.product
  
    const result = await BigQueryInventory.loadProductList(product);
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
    searchProductList
}