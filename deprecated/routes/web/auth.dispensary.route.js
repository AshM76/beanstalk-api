const { Router } = require('express')
const router = Router()

const authDispensaryCtrl = require('../../controllers/web/auth.dispensary/auth.dispensary.controller')

//API: Authentication
router.post('/web/auth/dispensary/signin', authDispensaryCtrl.validationDispensary, authDispensaryCtrl.signinDispensary)
router.post('/web/auth/dispensary/signup', authDispensaryCtrl.validationDispensary, authDispensaryCtrl.signupDispensary)
router.get('/web/auth/dispensary/emailVerification/:dispensary_email', authDispensaryCtrl.emailVerificationDispensary)
router.get('/web/auth/dispensary/accountValidate/:dispensary_id', authDispensaryCtrl.accountValidateDispensary)
//API: RestorePassword
router.get('/web/auth/dispensary/passwordCodeGenerate/:dispensary_email', authDispensaryCtrl.passwordCodeGenerateDispensary)
router.get('/web/auth/dispensary/passwordCodeValidate/:dispensary_email/:code', authDispensaryCtrl.passwordCodeValidateDispensary)
router.put('/web/auth/dispensary/passwordRestore/:dispensary_email', authDispensaryCtrl.passwordRestoreDispensary)

module.exports = router