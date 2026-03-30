const Service = require('../../../services')
const { check, validationResult } = require('express-validator')
const path = require('path')
const validationEmail = require('../../../utils/validationEmail')
const PasswordCodeGenerator = require('../../../utils/passwordCodeGenerator')

const BigQuery = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_auth')

///Authentication
async function signIn(req, res) {
    console.log(':: POST ')
    console.log(':: MOBILE/SignIn')
    console.log(req.body)

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: true, message: errors.array() });
    }

    // var emailLowerCase = req.body.email.toLowerCase();

    const result = await BigQuery.signIn(req.body.email, req.body.password)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            token: Service.createToken(result['data']['user_id']),
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function signUp(req, res) {
    console.log(':: POST')
    console.log(':: MOBILE/SignUp')
    console.log(req.body)

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: true, message: errors.array() });
    }

    const user = {
        user_email: req.body.email,
        user_password: req.body.password,

        user_gender: req.body.gender,
        user_age: req.body.age,
        user_firstName: req.body.firstname,
        user_lastName: req.body.lastname,
        user_userName: req.body.username,
        user_phoneNumber: req.body.phonenumber,

        user_conditions: req.body.conditions,
        user_medications: req.body.medications,

        user_marketingEmail: req.body.marketingEmail,
        user_marketingText: req.body.marketingText,
        user_agreementAccepted: req.body.agreementAccepted,
        user_ownerApp: req.body.ownerApp,
    }

    const emailVerification = await BigQuery.emailVerification(req.body.email)
    console.log(emailVerification);
    if (!emailVerification['error']) {
        return res.status(404).send({ error: emailVerification['error'], message: emailVerification['message'] })
    } else {
        const result = await BigQuery.signUp(user);
        console.log(result);
        if (result['error']) {
            return res.status(404).send({ error: result['error'], message: result['message'] })
        } else {
            console.log(':: Send Email Validation Account')
            console.log(`:: ${req.body.email}`)
            validationEmail.sendEmailValidation(req.body.email, result['data']['user_id'])
            return res.status(200).send({
                token: Service.createToken(result['data']['user_id']),
                data: result['data'],
                error: result['error'],
                message: result['message']
            })
        }
    }
}

async function emailVerification(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/EmailVerification')
    console.log(`:: email: ${req.params.email}`)

    let email = req.params.email

    const result = await BigQuery.emailVerification(email)
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

async function usernameVerification(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/UsernameVerification')
    console.log(`:: username: ${req.params.username}`)

    let username = req.params.username

    const result = await BigQuery.usernameVerification(username)
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

async function accountValidate(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/EmailConfirmAccount')
    console.log(`:: userid: ${req.params.userid}`)

    let userid = req.params.userid

    const result = await BigQuery.accountValidate(userid)

    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.sendFile(path.join(process.cwd(), '/src/public/email_confirm.html'))
    }
}

///Controller: RestorePassword
async function passwordCodeGenerate(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/PasswordCodeGenerate')
    console.log(`:: email: ${req.params.email}`)

    let email = req.params.email

    const codeRestorePassword = Number(PasswordCodeGenerator.getPasswordCode(6))

    const result = await BigQuery.passwordCodeGenerate(email, codeRestorePassword)

    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        console.log(':: Send email code reset password')
        validationEmail.sendEmailCodeRestorePassword(email, codeRestorePassword)
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: 'Restore Code Sent Successfuly',
        })
    }
}

async function passwordCodeValidate(req, res) {
    console.log(':: GET')
    console.log(':: MOBILE/PasswordCodeValidate')
    console.log(`:: email: ${req.params.email}`)
    console.log(`:: code: ${req.params.code}`)

    let email = req.params.email
    let code = req.params.code

    const result = await BigQuery.passwordCodeValidate(email, code)

    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message'] ,
        })
    }
}

async function passwordRestore(req, res) {
    console.log(':: PUT')
    console.log(':: MOBILE/PasswordRestore')
    console.log(`:: email: ${req.params.email}`)

    let email = req.params.email
    let restore = req.body.restore

    const result = await BigQuery.passwordRestore(email, restore)

    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            data: result['data'],
            error: result['error'],
            message: result['message'] ,
        })
    }
}

///Validation
let validation = [
    check('email').not().isEmpty().withMessage('[email] is a required field.'),
    check('email').isEmail().withMessage('[email] format is incorrect.'),
    check('password').not().isEmpty().withMessage('[password] is a required field.'),
    check('password').isLength({ min: 6 }).withMessage('[password] must be at least 6 characters.'),
]

module.exports = {
    signUp,
    signIn,
    emailVerification,
    usernameVerification,
    accountValidate,
    passwordCodeGenerate,
    passwordCodeValidate,
    passwordRestore,
    validation
}