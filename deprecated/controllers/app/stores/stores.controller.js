
const StoreConnection = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_stores')

async function loadStoreList(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/LoadStoreList')
    console.log(`:: consumerId: ${req.params.consumerId}`)

    let consumerId = req.params.consumerId

    if (req.query.search) {
        let search = req.query.search
        search = search.replace(/[^a-zA-Z ]/g, "")
        console.log(`search: ${search}`)
        const result = await StoreConnection.loadStoreListSearch(consumerId, search);   
        
        if (result['error']) {
            return res.status(404).send({ error: result['error'], message: result['message'] })
        } else {
            return res.status(200).send({
                data: result['data'],
                error: result['error'],
                message: result['message']
            })
        }
    } else {
        const result = await StoreConnection.loadStoreList(consumerId);

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

    
}

async function loadStoreInfo(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/LoadStoreInfo')
    console.log(`:: storeId: ${req.params.storeId}`)
    console.log(`:: consumerId: ${req.params.consumerId}`)

    let storeId = req.params.storeId
    let consumerId = req.params.consumerId

    const result = await StoreConnection.loadStoreInfo(storeId, consumerId);
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

// Store Favorites
async function setStoreFavorites(req, res) {
    console.log(':: POST')
    console.log(':: MOBILE/SetStoreFavorites')
    console.log(req.body)

    const consumerId = req.body.consumerId;
    const storeId = req.body.storeId;
    const active = req.body.active;

    const result = await StoreConnection.setStoreFavorites(consumerId, storeId, active);
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

async function loadStoreFavoritesList(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/LoadStoreFavoritesList')
    console.log(`:: consumerId: ${req.params.consumerId}`)

    let consumerId = req.params.consumerId

    const result = await StoreConnection.loadStoreFavoritesList(consumerId);
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

// Store Rating
async function setStoreRating(req, res) {
    console.log(':: POST')
    console.log(':: MOBILE/SetStoreRating')
    console.log(req.body)

    const consumerId = req.body.consumerId;
    const storeId = req.body.storeId;
    const rating = parseFloat(req.body.rating).toFixed(1);

    const result = await StoreConnection.setStoreRating(consumerId, storeId, rating);
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
    loadStoreList,
    loadStoreInfo,
    setStoreFavorites,
    loadStoreFavoritesList,
    setStoreRating,
}