const { check, validationResult } = require('express-validator')
const clinicianConnection = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_clinicians')

//Mobile: Deal List
async function loadClinicianList(req, res) {
  console.log(':: GET')
  console.log(':: APP/loadClinicianList')

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
    const result = await clinicianConnection.loadClinicianList(search);
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
    const result = await clinicianConnection.loadClinicianList(search);
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

//Mobile: Deal Detail
async function loadClinicianDetail(req, res) {
  console.log(':: GET')
  console.log(':: APP/loadClinicianDetail')
  console.log(`:: clinicianid: ${req.params.clinicianid}`)

  let clinicianid = req.params.clinicianid;

  const result = await clinicianConnection.loadClinicianDetail(clinicianid);
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
    loadClinicianList,
    loadClinicianDetail,
 }