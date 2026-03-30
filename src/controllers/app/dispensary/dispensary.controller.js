
const BigQuery = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_dispensary')

async function dispensaryList(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/LoadDispensaryList')
    console.log(`:: consumerId: ${req.params.consumerId}`)

    let consumerId = req.params.consumerId

    const result = await BigQuery.loadDispensaryList(consumerId);
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

// function dispensaryListByTitle(req, res) {
//     console.log('::')
//     console.log(':: GET - Dispensary List by Title')
    
//     let find = req.params.title
//     console.log(`:: >> search:${find}`)
//     const regex = new RegExp(`${find}`,`i`);
//     Dispensary.find({ title: { $regex: regex } },(err, dispensaries) => {

//         if (err) return res.status(500).send({ error: true, message: `Error: GET - Dispensary List by Title: ${err}` })
//         if (dispensaries <= 0) return res.status(404).send({ error: true, message: 'dispensaries not available' })

//         return res.status(200).send({
//             message: 'dispensary list',
//             dispensaries: dispensaries
//         })
//     })
// }

// function dispensaryListByLocation(req, res) {
//     console.log('::')
//     console.log(':: GET - Dispensary List by Location')

//     let longitude = req.params.longitude
//     let latitude = req.params.latitude
//     console.log(`:: >> latitude:${latitude}`)
//     console.log(`:: >> longitude:${longitude}`)

//     Dispensary.find({
//         location: {
//             $near: {
//                 $maxDistance: 1000,
//                 $geometry: {
//                     type: "Point",
//                     coordinates: [longitude, latitude]
//                 }
//             }
//         }
//     },(err, dispensaries) => {

//         if (err) return res.status(500).send({ error: true, message: `Error: GET - Dispensary List by Location: ${err}` })
//         if (dispensaries <= 0) return res.status(404).send({ error: true, message: 'dispensaries not available' })

//         return res.status(200).send({
//             message: 'dispensary list',
//             dispensaries: dispensaries
//         })
//     })
// }

async function dispensaryProfile(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/LoadDispensaryById')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)
    console.log(`:: consumerId: ${req.params.consumerId}`)

    let dispensaryId = req.params.dispensaryId
    let consumerId = req.params.consumerId

    const result = await BigQuery.loadDispensaryId(dispensaryId, consumerId);
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

// Dispensary Favorites
async function dispensarySetFavorites(req, res) {
    console.log(':: POST')
    console.log(':: MOBILE/SetDispensaryFavorite')
    console.log(req.body)

    const consumerId = req.body.consumerId;
    const dispensaryId = req.body.dispensaryId;
    const active = req.body.active;

    const result = await BigQuery.setDispensaryFavorite(consumerId, dispensaryId, active);
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

async function dispensaryFavoritesList(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/LoadDispensaryFavoritesList')
    console.log(`:: consumerId: ${req.params.consumerId}`)

    let consumerId = req.params.consumerId

    const result = await BigQuery.loadDispensaryFavoritesList(consumerId);
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

// Dispensary Favorites
async function dispensarySetRating(req, res) {
    console.log(':: POST')
    console.log(':: MOBILE/SetDispensaryRating')
    console.log(req.body)

    const consumerId = req.body.consumerId;
    const dispensaryId = req.body.dispensaryId;
    const rating = parseFloat(req.body.rating).toFixed(1);

    const result = await BigQuery.setDispensaryRating(consumerId, dispensaryId, rating);
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
    dispensaryList,
    // dispensaryListByTitle,
    // dispensaryListByLocation,
    dispensaryProfile,    // addDispensary
    dispensarySetFavorites,
    dispensaryFavoritesList,
    dispensarySetRating,
}