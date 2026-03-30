const { BigQuery } = require('@google-cloud/bigquery');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = "beanstalk_clinicians_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

//WEB: Clinician Create
async function createClinician(clinician) {

  var locationData = ""//("latitude","longitude");
  locationData = `(${clinician['clinician_location']['latitude']},${clinician['clinician_location']['longitude']})`;

  var hoursData = []
  if (clinician['clinician_hours']) {
    clinician['clinician_hours'].forEach(hours => {
      let date = new Date();
      let date_now = date.getMonth() + "/" + date.getDay() + "/" + date.getFullYear()
      var timeOpen = new Date(date_now + " " + hours['opensAt'])
      var timeClose = new Date(date_now + " " + hours['closesAt'])
      hoursData.push(`('${hours['day']}',
                       PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${timeOpen.toUTCString()}'),
                       PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${timeClose.toUTCString()}')
                      )`)
    });
  }

  var clinicianStatusData = "pending";
  var clinicianApprovalData = false;

  // Query
  const query = `INSERT ${keyDatasetId}.${keyTableId} (
                    clinician_id,
                    clinician_title,
                    clinician_firstName,
                    clinician_lastName,
                    clinician_photoURL,
                    clinician_about,
                    clinician_specialties,
                    clinician_certifications,
                    clinician_location,
                    clinician_addressLine1,
                    clinician_addressLine2,
                    clinician_city,
                    clinician_state,
                    clinician_zip,
                    clinician_country,
                    clinician_phone,
                    clinician_fax,
                    clinician_email,
                    clinician_website,
                    clinician_facebook,
                    clinician_instagram,
                    clinician_hours,
                    clinician_status,
                    clinician_approval,
                    clinician_signupDate,
                    clinician_approvalDate
                    )
                  VALUES (
                    GENERATE_UUID(),
                    '${clinician['clinician_title']}',
                    '${clinician['clinician_firstName']}',
                    '${clinician['clinician_lastName']}',
                    '${clinician['clinician_photoURL']}',
                    '${clinician['clinician_about']}',
                    '${clinician['clinician_specialties']}',
                    ${clinician['clinician_certifications']},
                    [${locationData.toString()}],
                    '${clinician['clinician_addressLine1']}',
                    '${clinician['clinician_addressLine2']}',
                    '${clinician['clinician_city']}',
                    '${clinician['clinician_state']}',
                    '${clinician['clinician_zip']}',
                    '${clinician['clinician_country']}',
                    '${clinician['clinician_phone']}',
                    '${clinician['clinician_fax']}',
                    '${clinician['clinician_email']}',
                    '${clinician['clinician_website']}',
                    '${clinician['clinician_facebook']}',
                    '${clinician['clinician_instagram']}',
                    [${hoursData.toString()}],
                    '${clinicianStatusData}',
                    ${clinicianApprovalData},
                    CURRENT_DATETIME(),
                    NULL
                    )
                  `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    const query = `SELECT *
                   FROM ${keyDatasetId}.${keyTableId} AS c
                   WHERE c.clinician_firstName = '${clinician['clinician_firstName']}' AND c.clinician_lastName = '${clinician['clinician_lastName']}' AND c.clinician_addressLine1 = '${clinician['clinician_addressLine1']}'
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      return {
        error: false,
        message: 'Clinician Created Successfuly',
        data: {
          clinician: rows[0]
        }
      }
    } else {
      return {
        error: true,
        message: 'Error Create clinician',
      }
    }



  } else {
    return {
      error: true,
      message: 'Error Create Clinician',
    }
  }
}

//API: Clinician List
async function loadClinicianList(search, admin) {

  var query = ``
  if (admin) {
    // Query
    query = `SELECT *
               FROM ${keyDatasetId}.${keyTableId} AS c
               WHERE CONTAINS_SUBSTR((c.clinician_title, c.clinician_firstName, c.clinician_lastName, c.clinician_specialties), '${search}')
               ORDER BY c.clinician_lastName ASC
               LIMIT 10
              `;
  } else {
    // Query
    query = `SELECT *
               FROM ${keyDatasetId}.${keyTableId} AS c
               WHERE CONTAINS_SUBSTR((c.clinician_title, c.clinician_firstName, c.clinician_lastName, c.clinician_specialties), '${search}') AND c.clinician_status = 'approve'
               ORDER BY c.clinician_lastName ASC
               LIMIT 10
              `;
  }

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Clinicians List Successfuly',
      data: {
        clinicians: rows,
      }
    }
  } else {
    return {
      error: true,
      message: 'Clinicians does not exist',
    }
  }
}

//API: Clinician Nearby
async function loadClinicianNearby(latitude, longitude) {

  // $DISTANCE_KILOMETERS = your radius of search in Kilometers e.g 150
  let distance = 100
  // Query
  const query = `SELECT * FROM (
                  SELECT *, 
                      (
                          (
                              (
                                  acos(
                                      sin(( ${latitude} * ACOS(-1) / 180))
                                      *
                                      sin(( l.latitude * ACOS(-1) / 180)) + cos(( ${latitude} * ACOS(-1) /180 ))
                                      *
                                      cos(( l.latitude * ACOS(-1) / 180)) * cos((( ${longitude} - l.longitude) * ACOS(-1)/180)))
                              ) * 180/ACOS(-1)
                          ) * 60 * 1.1515 * 1.609344
                      )
                  as distance FROM ${keyDatasetId}.${keyTableId} AS c, UNNEST(c.clinician_location) as l
                 ) myTable
                 WHERE distance <= ${distance} AND myTable.clinician_status = 'approve'
                 LIMIT 10
                `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Clinicians List Successfuly',
      data: {
        clinicians: rows,
      }
    }
  } else {
    return {
      error: true,
      message: 'Clinicians does not exist',
    }
  }
}

//WEB: Clinician Status
async function loadClinicianStatus(status) {

  var query = ``
  if (status == "all") {
    // Query
    query = `SELECT *
                   FROM ${keyDatasetId}.${keyTableId} AS c
                   ORDER BY c.clinician_signupDate ASC
                  `;
  } else {
    // Query
    query = `SELECT *
                   FROM ${keyDatasetId}.${keyTableId} AS c
                   WHERE c.clinician_status = '${status}'
                   ORDER BY c.clinician_signupDate ASC
                   LIMIT 10
                  `;
  }

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Clinicians List Successfuly',
      data: {
        clinicians: rows,
      }
    }
  } else {
    return {
      error: true,
      message: 'Clinicians does not exist',
    }
  }
}

//WEB: Clinician Zip
async function loadClinicianZip(zip) {

  var query = `SELECT *
                FROM ${keyDatasetId}.${keyTableId} AS c
                WHERE CONTAINS_SUBSTR((c.clinician_zip), '${zip}') AND c.clinician_status = 'approve'
                ORDER BY c.clinician_signupDate ASC
                LIMIT 10
              `; 

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Clinicians List Successfuly',
      data: {
        clinicians: rows,
      }
    }
  } else {
    return {
      error: true,
      message: 'Clinicians does not exist',
    }
  }
}

//Mobile: Clinician Detail
async function loadClinicianDetail(clinicianId) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS c
                 WHERE c.clinician_id = '${clinicianId}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {

    return {
      error: false,
      message: 'Clinician Successfuly',
      data: {
        clinician: rows[0],
      }
    }

  } else {
    return {
      error: true,
      message: 'Load Clinician Error',
    }
  }
}

//WEB: Clinician Update
async function updateClinician(clinicianId, update) {

  const updateData = [];

  if (update['clinician_title']) {
    updateData.push(`c.clinician_title = '${update['clinician_title']}'`)
  }

  if (update['clinician_firstName']) {
    updateData.push(`c.clinician_firstName = '${update['clinician_firstName']}'`)
  }

  if (update['clinician_lastName']) {
    updateData.push(`c.clinician_lastName = '${update['clinician_lastName']}'`)
  }

  if (update['clinician_photoURL']) {
    updateData.push(`c.clinician_photoURL = '${update['clinician_photoURL']}'`)
  }

  if (update['clinician_about']) {
    updateData.push(`c.clinician_about = '${update['clinician_about']}'`)
  }

  if (update['clinician_specialties']) {
    updateData.push(`c.clinician_specialties = '${update['clinician_specialties']}'`)
  }

  if (update['clinician_certifications']) {
    updateData.push(`c.clinician_certifications = ${update['clinician_certifications']}`)
  }

  if (update['clinician_numberNPI']) {
    updateData.push(`c.clinician_numberNPI = ${update['clinician_numberNPI']}`)
  }

  if (update['clinician_location']) {
    locationData = `STRUCT(${update['clinician_location']['latitude']},${update['clinician_location']['longitude']})`;
    updateData.push(`c.clinician_location = [${locationData}]`)
  }

  if (update['clinician_addressLine1']) {
    updateData.push(`c.clinician_addressLine1 = '${update['clinician_addressLine1']}'`)
  }

  if (update['clinician_addressLine2']) {
    updateData.push(`c.clinician_addressLine2 = '${update['clinician_addressLine2']}'`)
  }

  if (update['clinician_city']) {
    updateData.push(`c.clinician_city = '${update['clinician_city']}'`)
  }

  if (update['clinician_state']) {
    updateData.push(`c.clinician_state = '${update['clinician_state']}'`)
  }

  if (update['clinician_zip']) {
    updateData.push(`c.clinician_zip = '${update['clinician_zip']}'`)
  }

  if (update['clinician_country']) {
    updateData.push(`c.clinician_country = '${update['clinician_country']}'`)
  }

  if (update['clinician_phone']) {
    updateData.push(`c.clinician_phone = '${update['clinician_phone']}'`)
  }

  if (update['clinician_fax']) {
    updateData.push(`c.clinician_fax = '${update['clinician_fax']}'`)
  }

  if (update['clinician_email']) {
    updateData.push(`c.clinician_email = '${update['clinician_email']}'`)
  }

  if (update['clinician_website']) {
    updateData.push(`c.clinician_website = '${update['clinician_website']}'`)
  }

  if (update['clinician_facebook']) {
    updateData.push(`c.clinician_facebook = '${update['clinician_facebook']}'`)
  }

  if (update['clinician_instagram']) {
    updateData.push(`c.clinician_instagram = '${update['clinician_instagram']}'`)
  }

  if (update['clinician_hours']) {

    var hoursData = []
    update['clinician_hours'].forEach(hours => {
      let date = new Date();
      let date_now = date.getMonth() + "/" + date.getDay() + "/" + date.getFullYear()
      var timeOpen = new Date(date_now + " " + hours['opensAt'])
      var timeClose = new Date(date_now + " " + hours['closesAt'])
      hoursData.push(`('${hours['day']}',
                       PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${timeOpen.toUTCString()}'),
                       PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${timeClose.toUTCString()}')
                      )`)
    });

    updateData.push(`c.clinician_hours = [${hoursData.toString()}]`)
  }

  if (update['clinician_status']) {
    updateData.push(`c.clinician_status = '${update['clinician_status']}'`)
    if (update['clinician_status'] == 'approve') {
      updateData.push(`c.clinician_approval = TRUE`)
      updateData.push(`c.clinician_approvalDate = CURRENT_DATETIME()`)
    } else if (update['clinician_status'] == 'rejected') {
      updateData.push(`c.clinician_approval = FALSE`)
    }
  }

  console.log(updateData)

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyTableId} AS c
                 SET ${updateData}
                 WHERE c.clinician_id = '${clinicianId}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {

    // Query   
    const query = `SELECT c.*
                   FROM ${keyDatasetId}.${keyTableId} AS c
                   WHERE c.clinician_id = '${clinicianId}' 
                  `;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rowsClinician] = await bigquery.query(options);

    if (rowsClinician.length > 0) {

      return {
        error: false,
        message: 'Update Clinician Successfuly',
        data: {
          clinician: rowsClinician[0],
        }
      }
    }


  } else {
    return {
      error: true,
      message: 'Error Update Clinician Profile',
    }
  }

}

//WEB: Clinician Delete
async function deleteClinician(clinicianId) {

  // Query   
  const query = `DELETE ${keyDatasetId}.${keyTableId} AS c
                 WHERE c.clinician_id = '${clinicianId}'
                `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Clinician Delete Successfuly',
      data: {
        clinician: [],
      }
    }
  } else {
    return {
      error: false,
      message: 'Clinician does not exist',
      data: {
        clinician: [],
      }
    }
  }
}

module.exports = {
  createClinician,
  loadClinicianList,
  loadClinicianNearby,
  loadClinicianStatus,
  loadClinicianZip,
  loadClinicianDetail,
  updateClinician,
  deleteClinician
}