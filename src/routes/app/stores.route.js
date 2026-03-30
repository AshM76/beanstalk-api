const { Router } = require('express')
const router = Router()

const storeCtrl = require('../../controllers/app/stores/stores.controller');

//API: Store
router.get('/store/:consumerId', storeCtrl.loadStoreList)
router.get('/store/:storeId/consumer/:consumerId', storeCtrl.loadStoreInfo)

//API: Store Favorites
router.post('/store/favorites', storeCtrl.setStoreFavorites)
router.get('/store/favorites/:consumerId', storeCtrl.loadStoreFavoritesList)

//API: Store Rating
router.post('/store/rating', storeCtrl.setStoreRating)

module.exports = router