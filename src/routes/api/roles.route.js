const { Router } = require('express')
const router = Router()

const roleCtrl = require('../../controllers/api/roles/roles.controller')

//API: Roles

//Api
router.post('/web/navigation', roleCtrl.validationRole, roleCtrl.createRole)
router.get('/web/navigation/:dispensaryId', roleCtrl.loadRoleNavigation )

router.get('/web/roles', roleCtrl.loadRoleList )
router.get('/web/roles/users', roleCtrl.loadUsersRoleList )
router.put('/web/roles/:userid', roleCtrl.updateUserRole )

module.exports = router