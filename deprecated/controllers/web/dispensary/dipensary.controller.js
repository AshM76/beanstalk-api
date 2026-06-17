
const DispensaryConnection = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_dispensary')

const validationEmail = require('../../../utils/validationEmail')
const sanitize = require('../../../utils/string_sanitize')

//Dispensary Dashboard
async function dataDispensaryDashboard(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/Dashboard')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)

    let dispensaryId = req.params.dispensaryId

    const result = await DispensaryConnection.dataDispensaryDashboard(dispensaryId);
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

// Dispensary Data
async function dataDispensaryProfile(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/DataProfile')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)

    let dispensaryId = req.params.dispensaryId

    const result = await DispensaryConnection.dataDispensaryProfile(dispensaryId);
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

async function updateDispensaryProfile(req, res) {
    console.log(':: PUT')
    console.log(':: WEB/Dispensary/UpdateProfile')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)
    console.log(req.body)

    let dispensaryId = req.params.dispensaryId
    let update = req.body

    update.dispensary_name = sanitize.specialChars(update.dispensary_name)
    update.dispensary_description = sanitize.specialChars(update.dispensary_description)
    update.dispensary_license = sanitize.specialChars(update.dispensary_license)

    const result = await DispensaryConnection.updateDispensaryProfile(dispensaryId, update)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        if (result['emailUpdate']){
            console.log(':: Send Dispensary Email Validation Account')
            console.log(`:: ${update['dispensary_email']}`)
            validationEmail.sendEmailValidation(update['dispensary_email'], dispensaryId)
        }
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

// Store
async function getStoreDispensaryProfile(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/StoreProfile')
    console.log(`:: storeId: ${req.params.storeId}`)

    let storeId = req.params.storeId

    const result = await DispensaryConnection.getStoreDispensaryProfile(storeId);
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

async function addStoreDispensaryProfile(req, res) {
    console.log(':: POST')
    console.log(':: WEB/Dispensary/AddStore')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)
    console.log(req.body)

    let dispensaryId = req.params.dispensaryId
    let store = req.body

    store.store_name = sanitize.specialChars(store.store_name)
    store.store_description = sanitize.specialChars(store.store_description)
    store.store_email = sanitize.specialChars(store.store_email)
    store.store_addressLine1 = sanitize.specialChars(store.store_addressLine1)
    store.store_addressLine2 = sanitize.specialChars(store.store_addressLine2)
    store.store_city = sanitize.specialChars(store.store_city)
    store.store_website = sanitize.specialChars(store.store_website)
    store.store_facebook = sanitize.specialChars(store.store_facebook)
    store.store_instagram = sanitize.specialChars(store.store_instagram)
    store.store_twitter = sanitize.specialChars(store.store_twitter)
    store.store_youtube = sanitize.specialChars(store.store_youtube)

    store.store_dispensary_name = sanitize.specialChars(store.store_dispensary_name)

    const result = await DispensaryConnection.addStoreDispensaryProfile(dispensaryId, store)
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

async function updateStoreDispensaryProfile(req, res) {
    console.log(':: PUT')
    console.log(':: WEB/Dispensary/UpdateStore')
    console.log(`:: storeId: ${req.params.storeId}`)
    console.log(req.body)

    let storeId = req.params.storeId
    let update = req.body

    update.store_name = sanitize.specialChars(update.store_name)
    update.store_description = sanitize.specialChars(update.store_description)
    update.store_email = sanitize.specialChars(update.store_email)
    update.store_addressLine1 = sanitize.specialChars(update.store_addressLine1)
    update.store_addressLine2 = sanitize.specialChars(update.store_addressLine2)
    update.store_city = sanitize.specialChars(update.store_city)
    update.store_website = sanitize.specialChars(update.store_website)
    update.store_facebook = sanitize.specialChars(update.store_facebook)
    update.store_instagram = sanitize.specialChars(update.store_instagram)
    update.store_twitter = sanitize.specialChars(update.store_twitter)
    update.store_youtube = sanitize.specialChars(update.store_youtube)

    update.store_dispensary_name = sanitize.specialChars(update.store_dispensary_name)

    const result = await DispensaryConnection.updateStoreDispensaryProfile(storeId, update)
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

async function listStoreDispensaryProfile(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/ListStoreDispensary')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)

    let dispensaryId = req.params.dispensaryId

    const result = await DispensaryConnection.listStoreDispensaryProfile(dispensaryId);
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

async function deleteStoreDispensaryProfile(req, res) {
    console.log(':: DELETE')
    console.log(':: WEB/Dispensary/DeleteStoreDispensary')
    console.log(`:: storeId: ${req.params.storeId}`)

    let storeId = req.params.storeId

    const result = await DispensaryConnection.deleteStoreDispensaryProfile(storeId);
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

// Secondary Accounts
async function addAccountDispensaryProfile(req, res) {
    console.log(':: POST')
    console.log(':: WEB/Dispensary/AddAccount')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)
    console.log(req.body)

    let dispensaryId = req.params.dispensaryId
    let account = req.body

    account.dispensary_account_fullname = sanitize.specialChars(account.dispensary_account_fullname)
    account.dispensary_account_email = sanitize.specialChars(account.dispensary_account_email)

    const AuthDispensaryConnection = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_auth.dispensary')

    const emailVerification = await AuthDispensaryConnection.emailVerificationDispensary(account.dispensary_account_email)
    console.log(emailVerification);
    if (!emailVerification['error']) {
        return res.status(404).send({ error: true, message: emailVerification['message'] })
    } else {
        const result = await DispensaryConnection.addAccountDispensaryProfile(dispensaryId, account)
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

}

async function updateAccountDispensaryProfile(req, res) {
    console.log(':: PUT')
    console.log(':: WEB/Dispensary/UpdateAccount')
    console.log(`:: accountId: ${req.params.accountId}`)
    console.log(req.body)

    let accountId = req.params.accountId
    let update = req.body

    update.dispensary_account_fullname = sanitize.specialChars(update.dispensary_account_fullname)

    const result = await DispensaryConnection.updateAccountDispensaryProfile(accountId, update)
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

async function dataAccountDispensaryProfile(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/DataAccountProfile')
    console.log(`:: dispensaryId: ${req.params.dispensaryId}`)
    console.log(`:: accountId: ${req.params.accountId}`)

    let dispensaryId = req.params.dispensaryId
    let accountId = req.params.accountId

    const result = await DispensaryConnection.dataAccountDispensaryProfile(dispensaryId, accountId);
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

async function deleteAccountDispensaryProfile(req, res) {
    console.log(':: DELETE')
    console.log(':: WEB/Dispensary/DeleteAccountProfile')
    console.log(`:: accountId: ${req.params.accountId}`)

    let accountId = req.params.accountId

    const result = await DispensaryConnection.deleteAccountDispensaryProfile(accountId);
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
    //Dashboard
    dataDispensaryDashboard,
    // Profile
    dataDispensaryProfile,
    updateDispensaryProfile,
    // Store
    getStoreDispensaryProfile,
    addStoreDispensaryProfile,
    updateStoreDispensaryProfile,
    listStoreDispensaryProfile,
    deleteStoreDispensaryProfile,
    // Secondary Account
    addAccountDispensaryProfile,
    updateAccountDispensaryProfile,
    dataAccountDispensaryProfile,
    deleteAccountDispensaryProfile
}