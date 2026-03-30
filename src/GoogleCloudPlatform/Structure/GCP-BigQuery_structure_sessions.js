
async function setSessionsTables(BigQueryConnection, keyDatasetId) {

  setSessionsDataTable(BigQueryConnection,keyDatasetId)
                         
}

async function setSessionsDataTable(BigQueryConnection, keyDatasetId) {

  // Create a table
  const keyTableId = "beanstalk_sessions_data";

  symptomSchema = [ { name: 'symptom_title', type: 'STRING', mode: 'REQUIRED' } ]

  medicationSchema = { name: 'medication_title', type: 'STRING', mode: 'REQUIRED' },
  
  especieSchema = { name: 'specie_title', type: 'STRING', mode: 'REQUIRED' },

  cannabinoidSchema = [ { name: 'cannabinoid_title', type: 'STRING', mode: 'REQUIRED' },
                        { name: 'cannabinoid_value', type: 'STRING', mode: 'REQUIRED' }]
  
  terpeneSchema = [ { name: 'terpene_title', type: 'STRING', mode: 'REQUIRED' },
                    { name: 'terpene_value', type: 'STRING', mode: 'REQUIRED' }]
  
  measurementSchema = { name: 'measurement_title', type: 'STRING', mode: 'REQUIRED' },

  doseSchema = { name: 'dose_value', type: 'STRING', mode: 'REQUIRED' },

  timelineSchema = [ { name: 'timeline_id', type: 'STRING', mode: 'REQUIRED' },
                     { name: 'timeline_type', type: 'STRING', mode: 'REQUIRED'  },
                     { name: 'timeline_title', type: 'STRING' },
                     { name: 'timeline_value', type: 'STRING' },
                     { name: 'timeline_rate', type: 'INTEGER' },
                     { name: 'timeline_position', type: 'INTEGER' },
                     { name: 'timeline_time', type: 'DATETIME', mode: 'REQUIRED' }]

  ////SESSION
  sessionSchema = [
    { name: 'session_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
    //Symptoms
    { name: 'session_symptoms', type: 'RECORD', "mode": "REPEATED", fields: symptomSchema },
    //Medication
    { name: 'session_medication', type: 'RECORD', "mode": "NULLABLE", fields: medicationSchema },
    //ProductName
    { name: 'session_strain', type: 'STRING' },
    { name: 'session_product', type: 'STRING' },
    { name: 'session_brand', type: 'STRING' },
    //Specie
    { name: 'session_specie', type: 'RECORD', "mode": "NULLABLE", fields: especieSchema },
    //Temperature
    { name: 'session_temperature', type: 'STRING' },
    { name: 'session_temperatureMeasurement', type: 'RECORD', "mode": "NULLABLE", fields: measurementSchema },
    //ActiveIngredients
    { name: 'session_cannabinoids', type: 'RECORD', "mode": "REPEATED", fields: cannabinoidSchema },
    { name: 'session_terpenes', type: 'RECORD', "mode": "REPEATED", fields: terpeneSchema },
    { name: 'session_activeIngredientsMeasurement', type: 'RECORD', "mode": "NULLABLE", fields: measurementSchema },
    //Dose
    { name: 'session_dose', type: 'RECORD', "mode": "NULLABLE", fields: doseSchema },
    { name: 'session_doseMeasurement', type: 'RECORD', "mode": "NULLABLE", fields: measurementSchema },
    //Note
    { name: 'session_note', type: 'STRING' },
    { name: 'session_additional_notes', type: 'STRING', mode: 'REPEATED'},
    //SessionData
    { name: 'session_rate', type: 'INTEGER' }, // default 0
    { name: 'session_timelines', type: 'RECORD', "mode": "REPEATED", fields: timelineSchema },
    //SessionDates
    { name: 'session_startTime', type: 'DATETIME' },
    { name: 'session_endTime', type: 'DATETIME' },
    { name: 'session_durationTime', type: 'STRING' },
    { name: 'session_durationParameter', type: 'STRING' },
    //SessionStatus
    { name: 'session_status', type: 'STRING' }, // default "stored" 
    //SessionBackground
    { name: 'session_ownerApp', type: 'STRING' },
  ]

  const options = {
    schema: sessionSchema,
    location: 'US',
  };

  await BigQueryConnection.dataset(keyDatasetId)
                          .createTable(keyTableId, options)
                          .then(err => console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] created successfully`))
                          .catch(err => {console.log(`[Beanstalk] :: [GCP-BigQuery] : Table [${keyTableId}] already exists.`)})

                          
}

module.exports = {
  setSessionsTables
}