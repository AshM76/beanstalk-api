/**
 * Portfolio Routes
 * API endpoints for portfolio and trading operations
 */

const express = require('express')
const router = express.Router()
const portfolioController = require('../../controllers/portfolio.controller')

/**
 * Portfolio endpoints
 */
router.get('/portfolio/:userId', portfolioController.getPortfolio)
router.post('/portfolio/:userId/trade', portfolioController.executeTrade)
router.get('/portfolio/:userId/transactions', portfolioController.getTransactions)
router.put('/portfolio/:portfolioId/update-prices', portfolioController.updatePrices)

module.exports = router
