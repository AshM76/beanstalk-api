/**
 * Contest Asset Routes
 *
 * Mounted in app.js BEFORE the market router on purpose: market.route.js
 * does `router.use(auth)`, which forces auth on every /api/* request that
 * flows past it. GET here must stay public — the mobile app's image widgets
 * (CachedNetworkImage) fetch logos without an Authorization header.
 */

const express = require('express')
const router = express.Router()
const isAuth = require('../../middlewares/auth.middleware')
const assetController = require('../../controllers/asset.controller')

router.post('/contest-assets', isAuth, assetController.uploadAsset)
router.get('/contest-assets/:assetId', assetController.getAsset)

module.exports = router
