const Service = require('../../../services')
const { check, validationResult } = require('express-validator')
const path = require('path')
const validationEmail = require('../../../utils/validationEmail')
const PasswordCodeGenerator = require('../../../utils/passwordCodeGenerator')

const BigQuery = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_demo')

///Demo App
async function signDemo(req, res) {
    console.log(':: POST ')
    console.log(':: DEMO/SignDemo')
    console.log(req.body)

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: true, message: errors.array() });
    }

    let email = req.body.demo_email
    let owner = req.body.demo_ownerApp

    const result = await BigQuery.signDemo(email, owner)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            token: Service.createToken(result['data']['demo_id']),
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function dataDemo(req, res) {
    console.log(':: GET')
    console.log(':: DEMO/DataDemo')
    console.log(`:: demoid: ${req.params.demoid}`)

    let demoid = req.params.demoid

    let UserIdForDemo = "7cc7f623-b61a-4477-b29c-fb3cedbd3985"
    console.log(`:: UserIdForDemo: ${UserIdForDemo}`)

    const result = await BigQuery.dataDemo(UserIdForDemo)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            token: Service.createToken(demoid),
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function dealDemo(req, res) {
    console.log(':: GET')
    console.log(':: DEMO/DealDemo')
    console.log(`:: demoid: ${req.params.demoid}`)

    let demoid = req.params.demoid

    const result = await BigQuery.dealDemo()
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            token: Service.createToken(demoid),
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function sessionDemo(req, res) {
    console.log(':: GET')
    console.log(':: DEMO/SessionDemo')
    console.log(`:: demoid: ${req.params.demoid}`)

    let demoid = req.params.demoid

    const result = await BigQuery.sessionDemo()
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            token: Service.createToken(demoid),
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function storeListDemo(req, res) {
    console.log(':: GET')
    console.log(':: DEMO/StoreListDemo')
    console.log(`:: demoid: ${req.params.demoid}`)

    let demoid = req.params.demoid

    const result = await BigQuery.storeListDemo();
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

async function storeDemo(req, res) {
    console.log(':: GET')
    console.log(':: DEMO/StoreDemo')
    console.log(`:: demoid: ${req.params.demoid}`)

    let demoid = req.params.demoid

    const result = await BigQuery.storeDemo();
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

async function clinicianListDemo(req, res) {
    console.log(':: GET')
    console.log(':: DEMO/ClinicianListDemo')
    console.log(`:: demoid: ${req.params.demoid}`)

    let demoid = req.params.demoid

    const result = await BigQuery.clinicianListDemo();
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

async function clinicianDemo(req, res) {
    console.log(':: GET')
    console.log(':: DEMO/ClinicianDemo')
    console.log(`:: demoid: ${req.params.demoid}`)

    let demoid = req.params.demoid

    const result = await BigQuery.clinicianDemo();
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

///Validation
let validation = [
    check('demo_email').not().isEmpty().withMessage('[demo_email] is a required field.'),
    check('demo_email').isEmail().withMessage('[demo_email] format is incorrect.'),
    check('demo_ownerApp').not().isEmpty().withMessage('[demo_ownerApp] is a required field.'),
]

module.exports = {
    signDemo,
    dataDemo,
    dealDemo,
    sessionDemo,
    storeListDemo,
    storeDemo,
    clinicianListDemo,
    clinicianDemo,
    validation
}