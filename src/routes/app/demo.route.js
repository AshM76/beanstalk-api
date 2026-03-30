const { Router } = require('express')
const router = Router()

const demoCtrl = require('../../controllers/app/demo/demo.controller')
const auth = require('../../middlewares/auth.middleware')

//API: Demo
router.post('/demo/sign', demoCtrl.validation, demoCtrl.signDemo)
router.get('/demo/data/:demoid',auth ,demoCtrl.dataDemo)
router.get('/demo/deals/:demoid', demoCtrl.dealDemo )
router.get('/demo/session/:demoid',demoCtrl.sessionDemo)
router.get('/demo/store/list/:demoid', demoCtrl.storeListDemo)
router.get('/demo/store/:demoid', demoCtrl.storeDemo)
router.get('/demo/clinician/list/:demoid', demoCtrl.clinicianListDemo)
router.get('/demo/clinician/:demoid', demoCtrl.clinicianDemo)

module.exports = router