const { Router } = require('express')
const router = Router()

const notificationsCtrl = require('../../controllers/app/notifications/notifications.controller')

//API: Notifications
router.post('/notifications/active',notificationsCtrl.activeSessionTrack)
router.post('/notifications/stop',notificationsCtrl.stopSessionTrack)

module.exports = router