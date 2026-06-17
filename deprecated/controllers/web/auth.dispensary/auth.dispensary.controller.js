const Service = require('../../../services')
const { check, validationResult } = require('express-validator')
const path = require('path')
const validationEmail = require('../../../utils/validationEmail')
const PasswordCodeGenerator = require('../../../utils/passwordCodeGenerator')
const sanitize = require('../../../utils/string_sanitize')
const AuthDispensaryConnection = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_auth.dispensary')

///Authentication
async function signinDispensary(req, res) {
    console.log(':: POST ')
    console.log(':: WEB/Dispensary/SignIn')
    console.log(req.body)

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: true, message: errors.array() });
    }

    // var emailLowerCase = req.body.email.toLowerCase();

    const result = await AuthDispensaryConnection.signinDispensary(req.body.dispensary_email, req.body.dispensary_password)
    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.status(200).send({
            token: Service.createToken(result['data']['dispensary_id']),
            data: result['data'],
            error: result['error'],
            message: result['message']
        })
    }
}

async function signupDispensary(req, res) {
    console.log(':: POST')
    console.log(':: WEB/Dispensary/SignUp')
    console.log(req.body)

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: true, message: errors.array() });
    }
    
    const dispensary = {
        dispensary_email: sanitize.specialChars(req.body.dispensary_email),
        dispensary_password: req.body.dispensary_password,

        dispensary_license: sanitize.specialChars(req.body.dispensary_license),
        dispensary_name: sanitize.specialChars(req.body.dispensary_name),
        dispensary_description: sanitize.specialChars(req.body.dispensary_description),
        dispensary_logo: req.body.dispensary_logo,

        dispensary_stores: req.body.dispensary_stores,

        dispensary_agreementAccepted: req.body.dispensary_agreementAccepted,

        dispensary_available: req.body.dispensary_available,
        
        dispensary_ownerApp: req.body.dispensary_ownerApp,
    }

    const emailVerification = await AuthDispensaryConnection.emailVerificationDispensary(sanitize.specialChars(req.body.dispensary_email))
    console.log(emailVerification);
    if (!emailVerification['error']) {
        return res.status(404).send({ error: emailVerification['error'], message: emailVerification['message'] })
    } else {
        const result = await AuthDispensaryConnection.signupDispensary(dispensary);
        console.log(result);
        if (result['error']) {
            return res.status(404).send({ error: result['error'], message: result['message'] })
        } else {
            console.log(':: Send email validation account')
            console.log(req.body.dispensary_email)
            validationEmail.sendEmailValidation(req.body.dispensary_email, result['data']['dispensary_id'])
            return res.status(200).send({
                token: Service.createToken(result['data']['dispensary_id']),
                data: result['data'],
                error: result['error'],
                message: result['message']
            })
        }
    }
}

async function emailVerificationDispensary(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/EmailVerification')
    console.log(`:: email: ${req.params.dispensary_email}`)

    let email = req.params.dispensary_email

    const result = await AuthDispensaryConnection.emailVerificationDispensary(email)
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

async function accountValidateDispensary(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/EmailConfirmAccount')
    console.log(`:: dispensaryid: ${req.params.dispensaryId}`)

    let dispensaryid = req.params.dispensaryId

    const result = await AuthDispensaryConnection.accountValidateDispensary(dispensaryid)

    console.log(result);
    if (result['error']) {
        return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
        return res.sendFile(path.join(process.cwd(), '../../../utils/htmls/email_confirm.html'))
    }
}

///Controller: RestorePassword
async function passwordCodeGenerateDispensary(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/PasswordCodeGenerate')
    console.log(`:: email: ${req.params.dispensary_email}`)

    let email = req.params.dispensary_email

    const codeRestorePassword = Number(PasswordCodeGenerator.getPasswordCode(6))

    const result = await AuthDispensaryConnection.passwordCodeGenerateDispensary(email, codeRestorePassword)

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

async function passwordCodeValidateDispensary(req, res) {
    console.log(':: GET')
    console.log(':: WEB/Dispensary/PasswordCodeValidate')
    console.log(`:: email: ${req.params.dispensary_email}`)
    console.log(`:: code: ${req.params.code}`)

    let email = req.params.dispensary_email
    let code = req.params.code

    const result = await AuthDispensaryConnection.passwordCodeValidateDispensary(email, code)

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

async function passwordRestoreDispensary(req, res) {
    console.log(':: PUT')
    console.log(':: API/Dispensary/PasswordRestore')
    console.log(`:: email: ${req.params.dispensary_email}`)

    let email = req.params.dispensary_email
    let restore = req.body.restore

    const result = await AuthDispensaryConnection.passwordRestoreDispensary(email, restore)

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
let validationDispensary = [
    check('dispensary_email').not().isEmpty().withMessage('[email] is a required field.'),
    check('dispensary_email').isEmail().withMessage('[email] format is incorrect.'),
    check('dispensary_password').not().isEmpty().withMessage('[password] is a required field.'),
    check('dispensary_password').isLength({ min: 6 }).withMessage('[password] must be at least 6 characters.'),
]

module.exports = {
    //Authentication
    signinDispensary,
    signupDispensary,
    emailVerificationDispensary,
    accountValidateDispensary,
    //RestorePassword
    passwordCodeGenerateDispensary,
    passwordCodeValidateDispensary,
    passwordRestoreDispensary,
    //Validation
    validationDispensary
}