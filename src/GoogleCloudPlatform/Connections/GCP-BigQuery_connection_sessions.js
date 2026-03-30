
const { BigQuery } = require('@google-cloud/bigquery');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = "beanstalk_sessions_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

async function saveSession(session) {

  // Data
  var symptomsData = []//("symptom_title");
  if (session['session_symptoms']) {
    session['session_symptoms'].forEach(symptom => symptomsData.push(`STRUCT('${symptom['symptom_title']}')`));
  }

  var medicationData = ""//("medication_title");
  if (session['session_medication']) {
    medicationData = `STRUCT('${session['session_medication']['medication_title']}')`;
  }

  var specieData = ""//("specie_title");
  if (session['session_specie']) {
    specieData = `STRUCT('${session['session_specie']['specie_title']}')`;
  }

  var temperatureMeasurementData = ""//("measurement_title");
  if (session['session_temperatureMeasurement']) {
    temperatureMeasurementData = `STRUCT('${session['session_temperatureMeasurement']['measurement_title']}')`;
  }

  var cannabinoidsData = []//("cannabinoid_title","cannabinoid_value");
  if (session['session_cannabinoids']) {
    session['session_cannabinoids'].forEach(function (cannabinoid) {
      if (cannabinoid['cannabinoid_value'] != "") {
        cannabinoidsData.push(`('${cannabinoid['cannabinoid_title']}','${cannabinoid['cannabinoid_value']}')`)
      }
    });
  }

  var terpenesData = []//("terpene_title","terpene_value");
  if (session['session_terpenes']) {
    session['session_terpenes'].forEach(terpene => terpenesData.push(`('${terpene['terpene_title']}','${terpene['terpene_value']}')`));
  }

  var activeIngredientsMeasurementData = ""//("measurement_title");
  if (session['session_activeIngredientsMeasurement']) {
    activeIngredientsMeasurementData = `STRUCT('${session['session_activeIngredientsMeasurement']['measurement_title']}')`;
  }

  var doseData = ""//("dose_value");
  if (session['session_dose']) {
    doseData = `STRUCT('${session['session_dose']['dose_value']}')`;
  }

  var doseMeasurementData = ""//("measurement_title");
  if (session['session_doseMeasurement']) {
    doseMeasurementData = `STRUCT('${session['session_doseMeasurement']['measurement_title']}')`;
  }

  var timelinesData = []//("timeline_type","timeline_title","timeline_value","timeline_rate","timeline_position","timeline_time");
  if (session['session_timelines']) {
    session['session_timelines'].forEach(timeline => {
      var time = new Date(timeline['timeline_time'])
      timelinesData.push(`(GENERATE_UUID(),
                          '${timeline['timeline_type']}',
                          '${timeline['timeline_title']}',
                          '${timeline['timeline_value']}',
                          ${timeline['timeline_rate']},
                          ${timeline['timeline_position']},
                          PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT','${time.toUTCString()}')
                          )`)
    });
  }

  // Query
  const query = `INSERT ${keyDatasetId}.${keyTableId} (
                  session_id,
                  user_id,
                  
                  session_symptoms,

                  session_medication,

                  session_strain,
                  session_product,
                  session_brand,
                  
                  session_specie,

                  session_temperature,
                  session_temperatureMeasurement,

                  session_cannabinoids,
                  session_terpenes,
                  session_activeIngredientsMeasurement,

                  session_dose,
                  session_doseMeasurement,

                  session_note,

                  session_rate,
                  
                  session_timelines,

                  session_startTime,
                  session_endTime,
                  session_durationTime,
                  session_durationParameter,

                  session_status,

                  session_ownerApp
                  )
                VALUES (
                  GENERATE_UUID(),
                  '${session['user_id']}',

                  [${symptomsData.toString()}],

                  ${medicationData.toString()},
                  
                  '${session['session_strain']}',
                  '${session['session_product']}',
                  '${session['session_brand']}',

                  ${specieData.toString()},

                  '${session['session_temperature']}',
                  ${temperatureMeasurementData.toString()},
                  
                  [${cannabinoidsData.toString()}],
                  [${terpenesData.toString()}],
                  ${activeIngredientsMeasurementData.toString()},

                  ${doseData.toString()},
                  ${doseMeasurementData.toString()},

                  '${session['session_note']}',

                  ${session['session_rate']},

                  [${timelinesData.toString()}],
                  
                  PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT', '${session['session_startTime'].toUTCString()}'),
                  PARSE_DATETIME('%a, %e %b %Y %H:%M:%S GMT', '${session['session_endTime'].toUTCString()}'),
                  '${session['session_durationTime']}',
                  '${session['session_durationParameter']}',

                  '${session['session_status']}',

                  '${session['session_ownerApp']}'
                  )
                `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);
  console.log(rows)
  if (rows) {
    const query = `SELECT *
                   FROM ${keyDatasetId}.${keyTableId} AS s
                   WHERE s.user_id = '${session['user_id']}'
                   ORDER BY s.session_startTime DESC
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);
    console.log(rows)
    if (rows.length > 0) {
      return {
        error: false,
        message: 'Session Saved Successfuly',
        data: {
          session: rows[0],
        }
      }
    } else {
      return {
        error: true,
        message: 'Session Save Error',
      }
    }
  } else {
    return {
      error: true,
      message: 'Session Save Error',
    }
  }
}

async function loadSessionList(userid) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS s
                 WHERE s.user_id = '${userid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Session List Successfuly',
      data: {
        sessions: rows,
      }
    }
  } else {
    return {
      error: false,
      message: 'Sessions does not exist',
      data: {
        sessions: [],
      }
    }
  }
}

async function loadSessionById(sessionid) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS s
                 WHERE s.session_id = '${sessionid}'
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
      message: 'Session Successfuly',
      data: {
        session: rows[0],
      }
    }
  } else {
    return {
      error: true,
      message: 'Load Session Error',
    }
  }
}

async function addNoteSessionById(sessionid, note) {

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyTableId} AS s
                 SET s.session_additional_notes = ARRAY_CONCAT(s.session_additional_notes ,['${note.toString()}'])
                 WHERE s.session_id = '${sessionid}'`;

  const options = {
      query: query,
      location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {

      // Query
      const query = `SELECT *
                 FROM ${keyDatasetId}.${keyTableId} AS s
                 WHERE s.session_id = '${sessionid}'
                 LIMIT 1`;

      const options = {
          query: query,
          location: 'US',
      };

      // Connection
      const [rowsSession] = await bigquery.query(options);

      if (rowsSession.length > 0) {

          return {
              error: false,
              message: 'Add Session Note Successfuly',
              data: {
                  session: rowsSession[0],
              }
          }
      }

  } else {
      return {
          error: true,
          message: 'Error Add Session Note',
      }
  }
}

module.exports = {
  saveSession,
  loadSessionList,
  loadSessionById,
  addNoteSessionById
}