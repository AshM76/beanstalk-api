const { check, validationResult, param } = require('express-validator')

const BigQuery = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_sessions')

async function saveSession(req, res) {
    console.log(':: POST')
    console.log(':: MOBILE/SaveSessions')
    console.log(req.body)

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: true, message: errors.array() });
    }

    const session = {
        user_id: req.body.user_id,
        //Symptoms
        session_symptoms: req.body.symptoms,
        //Medications
        session_medication: req.body.medication,
        //ProductName
        session_strain: req.body.strain,
        session_product: req.body.product,
        session_brand: req.body.brand,
        //Species
        session_specie: req.body.specie,
        //Temperature
        session_temperature: req.body.temperature,
        session_temperatureMeasurement: req.body.temperatureMeasurement,
        //ActiveIngredients
        session_cannabinoids: req.body.cannabinoids,
        session_terpenes: req.body.terpenes,
        session_activeIngredientsMeasurement: req.body.activeIngredientsMeasurement,
        //Dose
        session_dose: req.body.dose,
        session_doseMeasurement: req.body.doseMeasurement,
        //Note
        session_note: req.body.note,
        //SessionData
        session_rate: req.body.rate,
        session_timelines: req.body.timelines,
        //SessionDates
        session_startTime: new Date(req.body.startTime),
        session_endTime: new Date(req.body.endTime),
        session_durationTime: req.body.durationTime,
        session_durationParameter: req.body.durationParameter,
        //SessionStatus
        session_status: req.body.status,
        //SessionBackground
        session_ownerApp: req.body.ownerApp
    }

    const result = await BigQuery.saveSession(session);
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        console.log(':: Session Saved Succesfuly')
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function loadSessions(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/LoadSessions')
    console.log(`:: userid: ${req.params.userid}`)

    let userid = req.params.userid

    const result = await BigQuery.loadSessionList(userid);
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

async function loadSessionById(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/LoadSessionById')
    console.log(`:: sessionid: ${req.params.sessionid}`)

    let sessionid = req.params.sessionid

    const result = await BigQuery.loadSessionById(sessionid);
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

async function addNoteSessionById(req, res) {
    console.log(':: PUT')
    console.log(':: MOBILE/AddNoteSessionById')
    console.log(`:: sessionid: ${req.params.sessionid}`)
    console.log(req.body)

    let sessionid = req.params.sessionid
    let note = req.body.note

    const result = await BigQuery.addNoteSessionById(sessionid, note)
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

let validation = [
    check('user_id').not().isEmpty().withMessage('[user_id] is a required field.'),
    // check('symptoms').not().isEmpty().withMessage('[symptoms] is a required field.'),
    // check('medication').isEmail().withMessage('[medication] format is incorrect.'),
    // check('strain').not().isEmpty().withMessage('[strain] is a required field.'),
]

module.exports = {
    saveSession,
    loadSessions,
    loadSessionById,
    addNoteSessionById,
    validation
}