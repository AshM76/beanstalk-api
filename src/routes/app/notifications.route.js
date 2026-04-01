const { Router } = require('express')
const router = Router()

const notificationsCtrl = require('../../controllers/app/notifications/notifications.controller')

//API: Notifications
router.post('/notifications/active',notificationsCtrl.activeSessionTrack)
router.post('/notifications/stop',notificationsCtrl.stopSessionTrack)
router.post('/notifications/contest-invite', notificationsCtrl.sendContestInvite)
router.post('/notifications/leaderboard-update', notificationsCtrl.sendLeaderboardUpdate)
router.post('/notifications/contest-winner', notificationsCtrl.sendContestWinner)

module.exports = router