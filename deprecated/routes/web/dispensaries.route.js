const { Router } = require('express')
const router = Router()

const dispensaryCtrl = require('../../controllers/web/dispensary/dipensary.controller')

//API: User Load Data
router.get('/web/dispensary/dashboard/:dispensaryId', dispensaryCtrl.dataDispensaryDashboard)
//API: Dispensaries
router.get('/web/dispensary/profile/:dispensaryId', dispensaryCtrl.dataDispensaryProfile)
router.put('/web/dispensary/profile/update/:dispensaryId', dispensaryCtrl.updateDispensaryProfile)
//API: Stores
router.get('/web/dispensary/profile/store/:storeId', dispensaryCtrl.getStoreDispensaryProfile)
router.post('/web/dispensary/profile/store/add/:dispensaryId', dispensaryCtrl.addStoreDispensaryProfile)
router.put('/web/dispensary/profile/store/update/:storeId', dispensaryCtrl.updateStoreDispensaryProfile)
router.get('/web/dispensary/profile/store/list/:dispensaryId', dispensaryCtrl.listStoreDispensaryProfile)
router.delete('/web/dispensary/profile/store/delete/:storeId', dispensaryCtrl.deleteStoreDispensaryProfile)
//API: SecondaryAccounts
router.post('/web/dispensary/profile/account/add/:dispensaryId', dispensaryCtrl.addAccountDispensaryProfile)
router.put('/web/dispensary/profile/account/update/:accountId', dispensaryCtrl.updateAccountDispensaryProfile)
router.get('/web/dispensary/profile/:dispensaryId/account/:accountId', dispensaryCtrl.dataAccountDispensaryProfile)
router.delete('/web/dispensary/profile/account/delete/:accountId', dispensaryCtrl.deleteAccountDispensaryProfile)
module.exports = router