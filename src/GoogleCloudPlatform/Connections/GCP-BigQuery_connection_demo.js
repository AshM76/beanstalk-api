
const { BigQuery } = require('@google-cloud/bigquery');

const bcrypt = require('bcryptjs');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyDemoTableId = "beanstalk_demo_data";
const keyUsersTableId = "beanstalk_users_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

async function signDemo(email, owner) {

  // Query
  const query = `SELECT d.demo_id, d.demo_email
                 FROM ${keyDatasetId}.${keyDemoTableId} AS d
                 WHERE d.demo_email = '${email}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {

    const queryUpdate = `UPDATE ${keyDatasetId}.${keyDemoTableId} AS d
                         SET d.demo_lastLogin = CURRENT_DATETIME()
                         WHERE d.demo_email = '${email}'`;

    const optionsUpdate = {
      query: queryUpdate,
      location: 'US',
    };

    // Connection
    await bigquery.query(optionsUpdate);

    return {
      error: false,
      message: 'Login successfuly',
      data: {
        demo_id: rows[0]['demo_id'],
        demo_email: rows[0]['demo_email']
      }
    }

  } else {

    // Query
    const queryInsert = `INSERT ${keyDatasetId}.${keyDemoTableId} (
                 demo_id,
                 demo_email,
                 demo_signupDate,
                 demo_lastLogin,
                 demo_ownerApp
                )
                 VALUES (
                 GENERATE_UUID(),
                 '${email}',                
                 CURRENT_DATETIME(),
                 CURRENT_DATETIME(),
                 '${owner}'
                )
                `;

    const options = {
      query: queryInsert,
      location: 'US',
    };

    // Connection
    const [rows] = await bigquery.query(options);
    if (rows) {
      const query = `SELECT d.demo_id, d.demo_email
                    FROM ${keyDatasetId}.${keyDemoTableId} AS d
                    WHERE d.demo_email = '${email}'
                    LIMIT 1`;

      const options = {
        query: query,
        location: 'US',
      };

      const [rows] = await bigquery.query(options);
      if (rows.length > 0) {
        return {
          error: false,
          message: 'Login successfuly',
          data: {
            demo_id: rows[0]['demo_id'],
            demo_email: rows[0]['demo_email']
          }
        }
      } else {
        return {
          error: true,
          message: 'Signup error',
        }
      }
    }

  }
}

async function dataDemo(demoid) {

  // Query
  const query = `SELECT *
                 FROM ${keyDatasetId}.${keyUsersTableId} AS u
                 WHERE u.user_id = '${demoid}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rowsProfile] = await bigquery.query(options);

  if (rowsProfile.length > 0) {
    return {
      error: false,
      message: 'Load Demo Data Successfuly',
      data: {
        user: rowsProfile[0],
        sessions: [{
          session_id: 'demo-session-001',
          session_specie: {
            specie_title: 'Sativa'
          },
          session_rate: 4,
          session_startTime: '2023-08-21T04:00:00.000Z',
          session_symptoms: [
            {
              symptom_title: "Insomnia"
            }
          ],
          session_medication: {
            medication_title: "Tinctures"
          },
          session_durationTime: "00:02:12",
        },
        {
          session_id: 'demo-session-002',
          session_specie: {
            specie_title: 'Hybrid'
          },
          session_rate: 3,
          session_startTime: '2023-08-20T04:00:00.000Z',
          session_symptoms: [
            {
              symptom_title: "Insomnia"
            }
          ],
          session_medication: {
            medication_title: "Tinctures"
          },
          session_durationTime: "00:02:12",
        },
        {
          session_id: 'demo-session-003',
          session_specie: {
            specie_title: 'Indica'
          },
          session_rate: 2,
          session_startTime: '2023-08-19T04:00:00.000Z',
          session_symptoms: [
            {
              symptom_title: "Insomnia"
            }
          ],
          session_medication: {
            medication_title: "Tinctures"
          },
          session_durationTime: "00:02:12",
        }],
        deals: [
          {
            deal_id: 'demo-deal-001',
            deal_title: 'Demo Deal 1',
            deal_imageURL: 'beanstalk-resources/deals/1660605612.png',
            deal_typeOfDeal: 'discount',
            deal_amount: '10'
          },
          {
            deal_id: 'demo-deal-002',
            deal_title: 'Demo Deal 2',
            deal_imageURL: 'beanstalk-resources/deals/1660605708.png',
            deal_typeOfDeal: 'dollar',
            deal_amount: '20'
          },
          {
            deal_id: 'demo-deal-003',
            deal_title: 'Demo Deal 3',
            deal_imageURL: 'beanstalk-resources/deals/1660605756.png',
            deal_typeOfDeal: 'bogo',
            deal_amount: '30'
          },
          {
            deal_id: 'demo-deal-004',
            deal_title: 'Demo Deal 4',
            deal_imageURL: 'beanstalk-resources/deals/1661265853.png',
            deal_typeOfDeal: 'b2g1',
            deal_amount: '40'
          }
        ],
        chat: []
      }
    }
  } else {
    return {
      error: true,
      message: 'Error Load Demo Data',
    }
  }
}

async function dealDemo(demoid) {

  return {
    error: false,
    message: 'Load Deal Data Successfuly',
    data: {
      deal:
      {
        deal_id: 'demo-deal-000',
        deal_title: 'Demo Deal',
        deal_description: 'Description demo deal',
        deal_imageURL: 'beanstalk-resources/deals/1660605612.png',
        deal_stores_availables: [
          {
            store_id: 'demo-store-01',
            store_name: 'Demo Store 1',
            store_addressLine1: 'Demo Adress Line'
          },
          {
            store_id: 'demo-store-02',
            store_name: 'Demo Store 2',
            store_addressLine1: 'Demo Adress Line'
          },
        ],
        deal_typeOfDeal: 'discount',
        deal_amount: '25',
        deal_typeOfProduct: 'Flower',
        deal_brandOfProduct: 'Brand Demo',
        deal_rangeDeal: 'custom',
        deal_startDate: '2022-08-21T04:00:00.000Z',
        deal_url: '',
        deal_publish_pushDate: '2022-08-10T12:00:00.000Z',
        deal_publish_timeZone: 'America/Los_Angeles',
        deal_status: 'published',
        deal_endDate: '2023-08-21T04:00:00.000Z',
        deal_dispensary_id: 'demo-dispensary-000',
        deal_dispensary_name: 'Demo Dispensary One',
        deal_deals: [
          {
            deal_id: 'demo-deal-001',
            deal_title: 'Demo Deal 1',
            deal_imageURL: 'beanstalk-resources/deals/1660605612.png',
            deal_typeOfDeal: 'discount',
            deal_amount: '10',
          },
          {
            deal_id: 'demo-deal-002',
            deal_title: 'Demo Deal 2',
            deal_imageURL: 'beanstalk-resources/deals/1660605708.png',
            deal_typeOfDeal: 'dollar',
            deal_amount: '20',
          },
          {
            deal_id: 'demo-deal-003',
            deal_title: 'Demo Deal 3',
            deal_description: 'Description demo deal 3',
            deal_imageURL: 'beanstalk-resources/deals/1660605756.png',
            deal_typeOfDeal: 'bogo',
            deal_amount: '30',
          }
        ],
      }
    }
  }

}

async function sessionDemo(demoid) {

  return {
    error: false,
    message: 'load Session Data Successfuly',
    data: {
      session: {
        session_id: "demo-session-001",
        user_id: "demo-user-001",
        session_symptoms: [
          {
            symptom_title: "Insomnia"
          }
        ],
        session_medication: {
          medication_title: "Tinctures"
        },
        session_strain: "",
        session_product: "",
        session_brand: "",
        session_specie: {
          specie_title: "Sativa"
        },
        session_temperature: "",
        session_temperatureMeasurement: {
          measurement_title: ""
        },
        session_cannabinoids: [],
        session_terpenes: [],
        session_activeIngredientsMeasurement: {
          measurement_title: ""
        },
        session_dose: {
          dose_value: "9"
        },
        session_doseMeasurement: {
          measurement_title: "drops"
        },
        session_note: "",
        session_rate: 3,
        session_timelines: [
          {
            timeline_id: "72a2540f-1cda-4900-96f2-77c095e9ed7f",
            timeline_type: "symptom",
            timeline_title: "Insomnia",
            timeline_value: "4",
            timeline_rate: 4,
            timeline_position: 0,
            timeline_time: {
              value: "2022-08-14T15:40:16"
            }
          },
          {
            timeline_id: "29d395cd-5624-4595-b36a-a8cbdf66ec07",
            timeline_type: "dose",
            timeline_title: "",
            timeline_value: "9",
            timeline_rate: 0,
            timeline_position: 1,
            timeline_time: {
              value: "2022-08-14T15:40:16"
            }
          },
          {
            timeline_id: "d2510f18-811b-4e7e-a5e3-0949df6b3cd6",
            timeline_type: "symptom",
            timeline_title: "Insomnia",
            timeline_value: "2",
            timeline_rate: 2,
            timeline_position: 0,
            timeline_time: {
              value: "2022-08-14T15:42:28"
            }
          }
        ],
        session_startTime: {
          value: "2022-08-14T15:40:16"
        },
        session_endTime: {
          value: "2022-08-14T15:42:28"
        },
        session_durationTime: "00:02:12",
        session_durationParameter: "m",
        session_status: "stored",
        session_ownerApp: "Beanstalk",
        session_additional_notes: []
      }

    }
  }

}

async function storeListDemo(demoid) {

  return {
    error: false,
    message: 'Stores List Successfuly',
    data: {
      "stores": [
        {
          "store_id": "demo-store-001",
          "store_name": "Demo Store One",
          "store_photos": [],
          "store_description": "Demo Store One Description",
          "store_addressLine1": "Address Line Demo Store",
          "store_addressLine2": "",
          "store_city": "City Demo Store",
          "store_state": "State Demo",
          "store_zip": "54321",
          "store_hours": [],
          "store_phone": "",
          "store_email": "",
          "store_website": "",
          "store_facebook": "",
          "store_instagram": "",
          "store_twitter": "",
          "store_youtube": "",
          "store_main": 2,
          "store_available": true,
          "store_registerDate": {
            "value": "2022-08-12T00:11:43.692762"
          },
          "store_dispensary_id": "demo-dispensary-001",
          "store_dispensary_name": "Demo Dispensary",
          "favorite": true,
          "rating": 3
        },
        {
          "store_id": "demo-store-002",
          "store_name": "Demo Store Two",
          "store_photos": [],
          "store_description": "Demo Store Two Description",
          "store_addressLine1": "Address Line Demo Store",
          "store_addressLine2": "",
          "store_city": "City Demo Store",
          "store_state": "State Demo",
          "store_zip": "12345",
          "store_hours": [],
          "store_phone": "",
          "store_email": "",
          "store_website": "",
          "store_facebook": "",
          "store_instagram": "",
          "store_twitter": "",
          "store_youtube": "",
          "store_main": 2,
          "store_available": true,
          "store_registerDate": {
            "value": "2022-08-12T00:11:43.692762"
          },
          "store_dispensary_id": "demo-dispensary-002",
          "store_dispensary_name": "Demo Dispensary",
          "favorite": false,
          "rating": 4.5
        },
        {
          "store_id": "demo-store-003",
          "store_name": "Demo Store Three",
          "store_photos": [],
          "store_description": "Demo Store Three Description",
          "store_addressLine1": "Address Line Demo Store",
          "store_addressLine2": "",
          "store_city": "City Demo Store",
          "store_state": "State Demo",
          "store_zip": "12345",
          "store_hours": [],
          "store_phone": "",
          "store_email": "",
          "store_website": "",
          "store_facebook": "",
          "store_instagram": "",
          "store_twitter": "",
          "store_youtube": "",
          "store_main": 2,
          "store_available": true,
          "store_registerDate": {
            "value": "2022-08-12T00:11:43.692762"
          },
          "store_dispensary_id": "demo-dispensary-003",
          "store_dispensary_name": "Demo Dispensary",
          "favorite": false,
          "rating": 2.5
        }
      ],
    }
  }
}

async function storeDemo(demoid) {

  return {
    error: false,
    message: 'Store info Successfuly',
    data: {
      store: {
        "store_id": "demo-store-001",
        "store_name": "Demo Store",
        "store_photos": [],
        "store_description": "Demo Store Description",
        "store_addressLine1": "Address Line Store",
        "store_addressLine2": "",
        "store_city": "City Demo Store",
        "store_state": "State Demo",
        "store_zip": "54321",
        "store_hours": [],
        "store_phone": "0123456789",
        "store_email": "store@dispensary.com",
        "store_website": "dispensary.com",
        "store_facebook": "fb/dispensary",
        "store_instagram": "instagram/dispensary",
        "store_twitter": "twitter/dispensary",
        "store_youtube": "youtube/dispensary",
        "store_main": 2,
        "store_available": true,
        "store_registerDate": {
          "value": "2022-08-12T00:11:43.692762"
        },
        "store_dispensary_id": "demo-dispensary-001",
        "store_dispensary_name": "Demo Dispensary",
        "favorite": true,
        "rating": 3,
        store_deals: [
          {
            deal_id: 'demo-deal-001',
            deal_title: 'Demo Deal 1',
            deal_imageURL: 'beanstalk-resources/deals/1660605612.png',
            deal_typeOfDeal: 'discount',
            deal_amount: '10',
          },
          {
            deal_id: 'demo-deal-002',
            deal_title: 'Demo Deal 2',
            deal_imageURL: 'beanstalk-resources/deals/1660605708.png',
            deal_typeOfDeal: 'dollar',
            deal_amount: '20',
          },
          {
            deal_id: 'demo-deal-003',
            deal_title: 'Demo Deal 3',
            deal_description: 'Description demo deal 3',
            deal_imageURL: 'beanstalk-resources/deals/1660605756.png',
            deal_typeOfDeal: 'bogo',
            deal_amount: '30',
          }
        ],
      },
    }
  }
}

async function clinicianListDemo(demoid) {

  return {
    error: false,
    message: 'Clinician List Successfuly',
    data: {
      "clinicians": [
        {
          "clinician_id": "demo-clinician-001",
          "clinician_title": "Dr.",
          "clinician_firstName": "Clinician One",
          "clinician_lastName": " Demo",
          "clinician_photoURL": "beanstalk-resources/clinicians/1665530119",
          "clinician_about": "Demo Description About to Clinician",
          "clinician_specialties": "Demo Speciality",
          "clinician_certifications": true,
          "clinician_location": [],
          "clinician_addressLine1": "Address Line Demo Clinician",
          "clinician_addressLine2": "",
          "clinician_city": "City Demo",
          "clinician_state": "CA",
          "clinician_zip": "12345",
          "clinician_country": "US",
          "clinician_phone": "0123456789",
          "clinician_fax": "",
          "clinician_email": "demo.clinician@gmail.com",
          "clinician_website": "clinician-demo.com",
          "clinician_facebook": "DemoClinician",
          "clinician_instagram": "DemoClinician",
          "clinician_hours": [],
          "clinician_status": "approve",
          "clinician_approval": true,
          "clinician_signupDate": {
            "value": "2022-12-01T00:10:10.692762"
          },
          "clinician_approvalDate": {
            "value": "2022-12-01T00:10:10.692762"
          },
          "clinician_numberNPI": null
        },
        {
          "clinician_id": "demo-clinician-002",
          "clinician_title": "Dr.",
          "clinician_firstName": "Clinician Two",
          "clinician_lastName": " Demo",
          "clinician_photoURL": "beanstalk-resources/clinicians/1665529919",
          "clinician_about": "Demo Description About to Clinician",
          "clinician_specialties": "Demo Speciality",
          "clinician_certifications": true,
          "clinician_location": [],
          "clinician_addressLine1": "Address Line Demo Clinician",
          "clinician_addressLine2": "",
          "clinician_city": "City Demo",
          "clinician_state": "CA",
          "clinician_zip": "12345",
          "clinician_country": "US",
          "clinician_phone": "0123456789",
          "clinician_fax": "",
          "clinician_email": "demo.clinician@gmail.com",
          "clinician_website": "clinician-demo.com",
          "clinician_facebook": "DemoClinician",
          "clinician_instagram": "DemoClinician",
          "clinician_hours": [],
          "clinician_status": "approve",
          "clinician_approval": true,
          "clinician_signupDate": {
            "value": "2022-12-01T00:10:10.692762"
          },
          "clinician_approvalDate": {
            "value": "2022-12-01T00:10:10.692762"
          },
          "clinician_numberNPI": null
        },
        {
          "clinician_id": "demo-clinician-003",
          "clinician_title": "Dr.",
          "clinician_firstName": "Clinician Three",
          "clinician_lastName": " Demo",
          "clinician_photoURL": "beanstalk-resources/clinicians/1665530303",
          "clinician_about": "Demo Description About to Clinician",
          "clinician_specialties": "Demo Speciality",
          "clinician_certifications": true,
          "clinician_location": [],
          "clinician_addressLine1": "Address Line Demo Clinician",
          "clinician_addressLine2": "",
          "clinician_city": "City Demo",
          "clinician_state": "CA",
          "clinician_zip": "12345",
          "clinician_country": "US",
          "clinician_phone": "0123456789",
          "clinician_fax": "",
          "clinician_email": "demo.clinician@gmail.com",
          "clinician_website": "clinician-demo.com",
          "clinician_facebook": "DemoClinician",
          "clinician_instagram": "DemoClinician",
          "clinician_hours": [],
          "clinician_status": "approve",
          "clinician_approval": true,
          "clinician_signupDate": {
            "value": "2022-12-01T00:10:10.692762"
          },
          "clinician_approvalDate": {
            "value": "2022-12-01T00:10:10.692762"
          },
          "clinician_numberNPI": null
        }
      ],
    }
  }
}

async function clinicianDemo(demoid) {

  return {
    error: false,
    message: 'Clinician info Successfuly',
    data: {
      clinician: {
        "clinician_id": "demo-clinician-001",
        "clinician_title": "Dr.",
        "clinician_firstName": "Clinician",
        "clinician_lastName": " Demo",
        "clinician_photoURL": "beanstalk-resources/clinicians/1665530303",
        "clinician_about": "Demo Description About to Clinician",
        "clinician_specialties": "Demo Speciality",
        "clinician_certifications": true,
        "clinician_location": [],
        "clinician_addressLine1": "Address Line Demo Clinician",
        "clinician_addressLine2": "",
        "clinician_city": "City Demo",
        "clinician_state": "CA",
        "clinician_zip": "12345",
        "clinician_country": "US",
        "clinician_phone": "0123456789",
        "clinician_fax": "",
        "clinician_email": "demo.clinician@gmail.com",
        "clinician_website": "clinician-demo.com",
        "clinician_facebook": "DemoClinician",
        "clinician_instagram": "DemoClinician",
        "clinician_hours": [],
        "clinician_status": "approve",
        "clinician_approval": true,
        "clinician_signupDate": {
          "value": "2022-12-01T00:10:10.692762"
        },
        "clinician_approvalDate": {
          "value": "2022-12-01T00:10:10.692762"
        },
        "clinician_numberNPI": null
      }
    }
  }
}

module.exports = {
  signDemo,
  dataDemo,
  dealDemo,
  sessionDemo,
  storeListDemo,
  storeDemo,
  clinicianListDemo,
  clinicianDemo
}