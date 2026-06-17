const { Router } = require('express')
const router = Router()

const chatCtrl = require('../../controllers/api/chat/chat.controller')

//API: Chat List
router.get('/chat/listbyConsumer/:consumerId', chatCtrl.chatListByConsumer)
router.get('/chat/listbyDispensary/:dispensaryId', chatCtrl.chatListByDispensary)
//API: Chat History
router.get('/chat/history/:consumerId/:dispensaryId/:storeId/:kind', chatCtrl.chatHistory)
//API: Chat Create
router.post('/chat/create', chatCtrl.chatCreate)
router.put('/chat/:chatId', chatCtrl.chatUpdateMessage)

module.exports = router