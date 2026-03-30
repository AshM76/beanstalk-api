const { Router } = require('express')
const router = Router()

const tradingCtrl = require('../../controllers/api/trading/trading.controller')

// API: Alpaca Paper Trading

router.get('/trading/account', tradingCtrl.getAccount)          // virtual account balance & status
router.get('/trading/portfolio', tradingCtrl.getPortfolio)      // current positions
router.get('/trading/price/:symbol', tradingCtrl.getStockPrice) // stock price by symbol (e.g. AAPL)
router.get('/trading/orders', tradingCtrl.getOrders)            // order history
router.post('/trading/order', tradingCtrl.placeOrder)           // place buy/sell order

module.exports = router
