/**
 * Auth routes for test/in-memory mode.
 *
 * POST /api/auth/register         — create account (public)
 * POST /api/auth/login            — sign in (public)
 * GET  /api/auth/me               — current user profile (requires JWT)
 * POST /api/auth/password/forgot  — request a reset code (public)
 * POST /api/auth/password/reset   — set a new password with a code (public)
 */

const router = require('express').Router()
const auth = require('../../middlewares/auth.middleware')
const authController = require('../../controllers/auth.controller')

router.post('/auth/register', authController.register)
router.post('/auth/login', authController.login)
router.get('/auth/me', auth, authController.me)
router.post('/auth/password/forgot', authController.forgotPassword)
router.post('/auth/password/reset', authController.resetPassword)

module.exports = router
