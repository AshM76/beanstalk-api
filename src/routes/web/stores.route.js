const { Router } = require('express')
const router = Router()

const storeCtrl = require('../../controllers/web/stores/stores.contoller')

//API: Stores
router.post('/web/dispensary/store/create', storeCtrl.createStore)
// router.put('/web/dispensary/profile/:userid', dispensaryCtrl.updateDispensaryProfile)

module.exports = router