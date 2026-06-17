const { Router } = require('express')
const router = Router()

const inventoryCtrl = require('../../controllers/api/inventory/inventory.controller')

//API: Inventory
router.get('/inventory/products/:product', inventoryCtrl.searchProductList)

module.exports = router