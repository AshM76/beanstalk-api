const Service = require('../../../services')

const BigQuery = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_chat')

async function chatListByConsumer(req, res) {
    console.log(':: GET')
    console.log(':: /ChatListByConsumer')
    console.log(`:: consumerId: ${req.params.consumerId}`)

    let consumerId = req.params.consumerId

    const result = await BigQuery.chatListByConsumer(consumerId)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function chatListByDispensary(req, res) {
    console.log(':: GET')
    console.log(':: /ChatListByDispensary')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)

    let dispensaryId = req.params.dispensaryId

    const result = await BigQuery.chatListByDispensary(dispensaryId)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function chatHistory(req, res) {
    console.log(':: GET')
    console.log(':: /ChatHistory')
    console.log(`:: consumerId: ${req.params.consumerId}`)
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)
    console.log(`:: storeId: ${req.params.storeId}`)
    console.log(`:: kind: ${req.params.kind}`)

    let consumerId = req.params.consumerId
    let dispensaryId = req.params.dispensaryId
    let storeId = req.params.storeId
    let kind = req.params.kind

    const result = await BigQuery.chatHistory(consumerId, dispensaryId, storeId, kind)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function chatCreate(req, res) {
    console.log(':: POST')
    console.log(':: /ChatCreate')
    console.log(req.body)

    const chat = {
        consumer_id: req.body.consumerId,
        dispensary_id: req.body.dispensaryId,
        store_id: req.body.storeId,
        messages: req.body.messages,
    }

    const result = await BigQuery.chatCreate(chat);
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        console.log(':: Chat Created Succesfuly')
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function chatSaveMessage(chatId, message) {
    console.log(':: /saveMessage')
    console.log(`:: chatid: ${chatId}`)
    console.log(message)

    const result = await BigQuery.chatSaveMessage(chatId, message)
    console.log(result);
    if (result['error']) {
        return false
    } else {
        return true
    }
}

async function chatMarkReadMessage(chatId, kind) { 
    console.log(':: /chatMarkReadMessage')
    console.log(`:: chatid: ${chatId}`)

    const result = await BigQuery.chatMarkReadMessage(chatId, kind)
    console.log(result);
    if (result['error']) {
        return false
    } else {
        return true
    }
}

async function chatUpdateMessage(req, res) {
    console.log(':: PUT')
    console.log(':: /ChatUpdate')
    console.log(`:: chatid: ${req.params.chatid}`)
    console.log(req.body)

    let chatid = req.params.chatid
    let messages = req.body

    const result = await BigQuery.chatUpdateMessage(chatid, messages)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

module.exports = {
    chatListByConsumer,
    chatListByDispensary,
    chatHistory,
    chatCreate,
    chatSaveMessage,
    chatMarkReadMessage,
    chatUpdateMessage
}