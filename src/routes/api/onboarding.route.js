const { Router } = require('express')
const router = Router()
const isAuth = require('../../middlewares/auth.middleware')
const ageVerificationCtrl = require('../../controllers/age_verification.controller')
const parentalConsentCtrl = require('../../controllers/parental_consent.controller')

// Age Verification Endpoints
router.post(
  '/onboarding/age-verify/self-report',
  isAuth,
  ageVerificationCtrl.verifySelfReported
)

router.post(
  '/onboarding/age-verify/id-verification/init',
  isAuth,
  ageVerificationCtrl.initIdVerification
)

router.post(
  '/onboarding/age-verify/id-verification/callback',
  ageVerificationCtrl.completeIdVerification
)

// Parental Consent Endpoints
router.post(
  '/onboarding/parental-consent/init',
  isAuth,
  parentalConsentCtrl.initParentalConsent
)

router.post(
  '/onboarding/parental-consent/verify',
  parentalConsentCtrl.verifyParentConsent
)

router.post(
  '/onboarding/parental-consent/resend',
  isAuth,
  parentalConsentCtrl.resendParentConsentEmail
)

router.post(
  '/onboarding/parental-consent/decline',
  isAuth,
  parentalConsentCtrl.declineParentalConsent
)

router.get(
  '/onboarding/parental-consent/status',
  isAuth,
  parentalConsentCtrl.getParentalConsentStatus
)

module.exports = router
