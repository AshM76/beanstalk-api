const { Router } = require('express')
const router = Router()

const authCtrl = require('../../controllers/app/auth/auth.controller')

//API: Authentication
router.post('/auth/signup', authCtrl.validation, authCtrl.signUp)
router.post('/auth/signin', authCtrl.validation, authCtrl.signIn)
router.get('/auth/emailVerification/:email', authCtrl.emailVerification)
router.get('/auth/usernameVerification/:username', authCtrl.usernameVerification)
router.get('/auth/accountValidate/:userid', authCtrl.accountValidate)
//API: RestorePassword
router.get('/auth/passwordCodeGenerate/:email', authCtrl.passwordCodeGenerate)
router.get('/auth/passwordCodeValidate/:email/:code', authCtrl.passwordCodeValidate)
router.put('/auth/passwordRestore/:email', authCtrl.passwordRestore)

module.exports = router