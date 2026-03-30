const { check, validationResult, query } = require('express-validator')
const clinicianConnection = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_clinicians')

const sanitize = require('../../../utils/string_sanitize')

//WEB: Clinician Create
async function createClinician(req, res) {
    console.log(':: POST')
    console.log(':: WEB/createClinician')
  
    console.log(req.body)

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: true, message: errors.array() });
    }

    let clinician = req.body

    clinician.clinician_title = sanitize.specialChars(clinician.clinician_title)
    clinician.clinician_firstName = sanitize.specialChars(clinician.clinician_firstName)
    clinician.clinician_lastName = sanitize.specialChars(clinician.clinician_lastName)
    clinician.clinician_addressLine1 = sanitize.specialChars(clinician.clinician_addressLine1)
    clinician.clinician_addressLine2 = sanitize.specialChars(clinician.clinician_addressLine2)
    clinician.clinician_city = clinician.clinician_city
    clinician.clinician_state = clinician.clinician_state
    clinician.clinician_zip = clinician.clinician_zip
    clinician.clinician_country = clinician.clinician_country

    clinician.clinician_phone = clinician.clinician_phone
    clinician.clinician_fax = clinician.clinician_fax
    clinician.clinician_email = sanitize.specialChars(clinician.clinician_email)
    clinician.clinician_website = sanitize.specialChars(clinician.clinician_website)
    
    clinician.clinician_photoURL = clinician.clinician_photoURL
    clinician.clinician_about = sanitize.specialChars(clinician.clinician_about)
    clinician.clinician_specialties = sanitize.specialChars(clinician.clinician_specialties)
    clinician.clinician_hours = clinician.clinician_hours
    clinician.clinician_certifications = clinician.clinician_certifications
    clinician.clinician_numberNPI = clinician.clinician_numberNPI
  
    const result = await clinicianConnection.createClinician(clinician)
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

//API: Clinician List
async function loadClinicianList(req, res) {
  console.log(':: GET')
  console.log(':: WEB/loadClinicianList')
  
  console.log(req.query)
  
  if(req.query.latitude && req.query.longitude){
    let latitude = req.query.latitude
    let longitude = req.query.longitude
    console.log(`latitude: ${latitude} & longitude: ${longitude}`)
    const result = await clinicianConnection.loadClinicianNearby(latitude,longitude);
    if (result['error']) {
      return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
      return res.status(200).send({
        data: result['data'],
        error: result['error'],
        message: result['message']
      })
    }
  } else if(req.query.status){
    let status = req.query.status
    console.log(`status: ${status}`)
    const result = await clinicianConnection.loadClinicianStatus(status);
    if (result['error']) {
      return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
      return res.status(200).send({
        data: result['data'],
        error: result['error'],
        message: result['message']
      })
    }
  } else if(req.query.zip){
    let zip = req.query.zip
    console.log(`zip: ${zip}`)
    const result = await clinicianConnection.loadClinicianZip(zip);
    if (result['error']) {
      return res.status(404).send({ error: result['error'], message: result['message'] })
    } else {
      return res.status(200).send({
        data: result['data'],
        error: result['error'],
        message: result['message']
      })
    }
  } else if(req.query.search){
    let search = req.query.search
    search = search.replace(/[^a-zA-Z ]/g, "")
    console.log(`search: ${search}`)

    var admin = false;
    if(req.query.admin == 'true'){
      console.log(req.query.admin)
      admin = true
    }

    const result = await clinicianConnection.loadClinicianList(search, admin);
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
    let search = ""
    const result = await clinicianConnection.loadClinicianList(search, false);
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

//WEB: Clinician Update
async function updateClinician(req, res) {
  console.log(':: UPDATE')
  console.log(':: WEB/updateClinician')
  console.log(`:: clinicianId: ${req.params.clinicianId}`)
  console.log(req.body)

  let clinicianId = req.params.clinicianId
  let update = req.body

  if(update.clinician_title){
    update.clinician_title = sanitize.specialChars(update.clinician_title)
  }
  if(update.clinician_firstName){
    update.clinician_firstName = sanitize.specialChars(update.clinician_firstName)
  }
  if(update.clinician_lastName){
    update.clinician_lastName = sanitize.specialChars(update.clinician_lastName)
  }
  if(update.clinician_about){
    update.clinician_about = sanitize.specialChars(update.clinician_about)
  }
  if(update.clinician_specialties){
    update.clinician_specialties = sanitize.specialChars(update.clinician_specialties)
  }
  if(update.clinician_addressLine1){
    update.clinician_addressLine1 = sanitize.specialChars(update.clinician_addressLine1)
  }
  if(update.clinician_addressLine2){
    update.clinician_addressLine2 = sanitize.specialChars(update.clinician_addressLine2)
  }
  if(update.clinician_email){
    update.clinician_email = sanitize.specialChars(update.clinician_email)
  }
  if(update.clinician_website){
    update.clinician_website = sanitize.specialChars(update.clinician_website)
  }
  if(update.clinician_facebook){
    update.clinician_facebook = sanitize.specialChars(update.clinician_facebook)
  }
  if(update.clinician_instagram){
    update.clinician_instagram = sanitize.specialChars(update.clinician_instagram)
  }

  const result = await clinicianConnection.updateClinician(clinicianId, update)
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

//WEB: Clinician Delete
async function deleteClinician(req, res) {
  console.log(':: DELETE')
  console.log(':: WEB/deleteClinician')
  console.log(`:: clinicianId: ${req.params.clinicianId}`)

  let clinicianId = req.params.clinicianId

  const result = await clinicianConnection.deleteClinician(clinicianId);
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

let validationClinician = [
  check('clinician_title').not().isEmpty().withMessage('[clinician_title] is a required field.'),
  check('clinician_firstName').not().isEmpty().withMessage('[clinician_firstName] is a required field.'),
  check('clinician_lastName').not().isEmpty().withMessage('[clinician_lastName] is a required field.'),
  check('clinician_addressLine1').not().isEmpty().withMessage('[clinician_addressLine1] is a required field.'),
  check('clinician_city').not().isEmpty().withMessage('[clinician_city] is a required field.'),
  check('clinician_state').not().isEmpty().withMessage('[clinician_state] is a required field.'),
  check('clinician_zip').not().isEmpty().withMessage('[clinician_zip] format is incorrect.'),
  check('clinician_country').not().isEmpty().withMessage('[clinician_country] format is incorrect.'),
  check('clinician_about').not().isEmpty().withMessage('[clinician_about] format is incorrect.'),
  check('clinician_email').not().isEmpty().withMessage('[email] is a required field.'),
  check('clinician_email').isEmail().withMessage('[email] format is incorrect.'),
]

module.exports = {
    createClinician,
    loadClinicianList,
    updateClinician,
    deleteClinician,
    validationClinician
 }