const { Router } = require('express')
const router = Router()

const dealsCtrl = require('../../controllers/api/deals/deals.controller')

//API: Deals

//WEB
router.get('/web/deals/:dispensaryid', dealsCtrl.loadDealsByDispensaryId )
router.get('/web/deals/detail/:dealid', dealsCtrl.loadDealDetailById )
router.post('/web/deals/create', dealsCtrl.createDeal )
router.put('/web/deals/update/:dealid', dealsCtrl.updateDeal )
//MOBILE
router.get('/deals/load', dealsCtrl.loadDeals )
router.get('/deals/:dealid', dealsCtrl.loadDealById )

module.exports = router