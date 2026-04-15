/**
 * Contest Routes
 * API endpoints for contest management and participation
 */

const express = require('express')
const router = express.Router()
const contestController = require('../../controllers/contest.controller')

/**
 * Contest endpoints
 */
router.post('/contests', contestController.createContest)
router.get('/contests', contestController.listContests)
router.get('/contests/:contestId', contestController.getContest)
router.put('/contests/:contestId', contestController.updateContest)
router.get('/contests/:contestId/participants', contestController.getContestParticipants)
router.post('/contests/:contestId/join', contestController.joinContest)
router.get('/contests/:contestId/leaderboard', contestController.getLeaderboard)
router.post('/contests/:contestId/conclude', contestController.concludeContest)

module.exports = router
