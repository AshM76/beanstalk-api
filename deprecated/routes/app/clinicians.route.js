const { Router } = require('express')
const router = Router()

const cliniciasCtrl = require('../../controllers/app/clinicians/clinicians.controller')

//API: Clinicias

//Mobile
router.get('/clinicians', cliniciasCtrl.loadClinicianList )
router.get('/clinicians/:clinicianid', cliniciasCtrl.loadClinicianDetail )

module.exports = router