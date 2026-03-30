const { Router } = require('express')
const router = Router()

const sessionCtrl = require('../../controllers/app/session/session.controller')

//API: Session
router.post('/session/save', sessionCtrl.validation ,sessionCtrl.saveSession)
router.get('/session/user/:userid',sessionCtrl.loadSessions)
router.get('/session/data/:sessionid',sessionCtrl.loadSessionById)
router.put('/session/addnote/:sessionid',sessionCtrl.addNoteSessionById)

module.exports = router