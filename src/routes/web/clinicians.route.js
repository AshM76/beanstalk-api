const { Router } = require('express')
const router = Router()

const cliniciasCtrl = require('../../controllers/web/clinicians/clinicians.controller')

//API: Clinicias

//Web
router.post('/web/clinicians', cliniciasCtrl.validationClinician, cliniciasCtrl.createClinician )
router.get('/web/clinicians', cliniciasCtrl.loadClinicianList )
router.put('/web/clinicians/:clinicianId', cliniciasCtrl.updateClinician )
router.delete('/web/clinicians/:clinicianId', cliniciasCtrl.deleteClinician )

module.exports = router