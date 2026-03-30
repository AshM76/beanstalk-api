const Service = require('../../../services')

const validationEmail = require('../../../utils/validationEmail')

const GCP = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_user')

async function userProfile(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/UserProfile')
    console.log(`:: userid: ${req.params.userid}`)

    let userid = req.params.userid

    const result = await GCP.userProfile(userid)
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

async function updateUserProfile(req, res) {
    console.log(':: PUT')
    console.log(':: MOBILE/UserProfile')
    console.log(`:: userid: ${req.params.userid}`)
    console.log(req.body)

    let userid = req.params.userid
    let update = req.body

    const result = await GCP.updateProfile(userid, update)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        if (result['emailUpdate']){
            console.log(':: Send Email Validation Account')
            console.log(`:: ${update['user_email']}`)
            validationEmail.sendEmailValidation(update['user_email'], userid)
        }
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function loadProfileData(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/Profile Data')
    console.log(`:: userid: ${req.params.userid}`)

    let userid = req.params.userid

    const result = await GCP.userProfileData(userid)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            token: Service.createToken(userid),
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

module.exports = {
    userProfile,
    updateUserProfile,
    loadProfileData
}