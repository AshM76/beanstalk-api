const { Router } = require('express')
const router = Router()
const isAuth = require('../../middlewares/auth.middleware')
const complianceCtrl = require('../../controllers/compliance.controller')

// Get EULA endpoints
router.get('/compliance/eula/:eulaType', complianceCtrl.getEulaByType)
router.get('/compliance/eula/:eulaType/:version', complianceCtrl.getEulaByVersion)

// Accept EULA endpoint
router.post('/compliance/accept-eula', isAuth, complianceCtrl.acceptEula)

// Get user's consent history
router.get('/compliance/user-consents', isAuth, complianceCtrl.getUserConsents)

// Check required consents
router.post(
  '/compliance/check-required-consents',
  isAuth,
  complianceCtrl.checkRequiredConsents
)

// User demographics endpoints
router.put('/user/demographics', isAuth, complianceCtrl.updateUserDemographics)

// Admin: Verify user status
router.get(
  '/admin/users/:userId/verification-status',
  isAuth,
  complianceCtrl.getVerificationStatus
)

// Admin: Update user account status
router.put(
  '/admin/users/:userId/account-status',
  isAuth,
  complianceCtrl.updateAccountStatus
)

// Contest eligibility check
router.get('/user/contest-eligibility', isAuth, complianceCtrl.checkContestEligibility)

module.exports = router
