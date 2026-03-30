const { Router } = require('express')
const router = Router()

const dispensaryCtrl = require('../../controllers/app/dispensary/dispensary.controller');

//API: Dispensary
router.get('/dispensary/:consumerId', dispensaryCtrl.dispensaryList)
// router.get('/dispensary/search/:title', dispensaryCtrl.dispensaryListByTitle)
// router.get('/dispensary/:longitude/:latitude', dispensaryCtrl.dispensaryListByLocation)
router.get('/dispensary/:dispensaryId/consumer/:consumerId', dispensaryCtrl.dispensaryProfile)
// router.post('/dispensary/add', dispensaryCtrl.addDispensary)

//API: Dispensary Favorites
router.post('/dispensary/favorites', dispensaryCtrl.dispensarySetFavorites)
router.get('/dispensary/favorites/:consumerId', dispensaryCtrl.dispensaryFavoritesList)

//API: Dispensary Rating
router.post('/dispensary/rating', dispensaryCtrl.dispensarySetRating)

module.exports = router