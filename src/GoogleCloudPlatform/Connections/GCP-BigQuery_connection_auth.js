
const { BigQuery } = require('@google-cloud/bigquery');

const bcrypt = require('bcryptjs');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = "beanstalk_users_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

async function signIn(email, password) {

  // Query
  const query = `SELECT user_id, user_password
                 FROM ${keyDatasetId}.${keyTableId} AS u
                 WHERE u.user_email = '${email}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    const login = bcrypt.compareSync(`${password}`, rows[0]['user_password'])
    if (login) {

      const queryUpdate = `UPDATE ${keyDatasetId}.${keyTableId} AS u
                           SET u.user_lastLogin = CURRENT_DATETIME()
                           WHERE u.user_email = '${email}'`;

      const optionsUpdate = {
        query: queryUpdate,
        location: 'US',
      };

      await bigquery.query(optionsUpdate);

      return {
        error: false,
        message: 'Login successfuly',
        data: {
          user_id: rows[0]['user_id']
        }
      }
    } else {
      return {
        error: true,
        message: 'Incorrect password',
      }
    }
  } else {
    return {
      error: true,
      message: 'Account does not exist',
    }
  }
}

async function signUp(user) {

  // Data
  const salt = await bcrypt.genSalt(10)
  const encryptPassword = await bcrypt.hash(user['user_password'], salt)

  var conditionsData = []//("condition_title");
  user['user_conditions'].forEach(condition => conditionsData.push(`STRUCT('${condition['condition_title']}')`));

  var medicationsData = []//("medication_title","medication_preference","medication_experience");
  user['user_medications'].forEach(medication => medicationsData.push(`('${medication['medication_title']}','${medication['medication_preference']}','${medication['medication_experience']}')`));

  // Query
  const query = `INSERT ${keyDatasetId}.${keyTableId} (
                  user_id,
                  user_email,
                  user_password,

                  user_gender,
                  user_age,
                  user_firstName,
                  user_lastName,
                  user_userName,
                  user_phoneNumber,
                  
                  user_conditions,
                  user_medications,

                  user_marketingEmail,
                  user_marketingText,

                  user_agreementAccepted,

                  user_timerNotifications,

                  user_signupDate,
                  user_lastLogin,
                  user_ownerApp
                  )
                VALUES (
                  GENERATE_UUID(),
                  '${user['user_email']}',
                  '${encryptPassword}',
                  
                  '${user['user_gender']}',
                  '${user['user_age']}',
                  '${user['user_firstName']}',
                  '${user['user_lastName']}',
                  '${user['user_userName']}',
                  '${user['user_phoneNumber']}',

                  [${conditionsData.toString()}],
                  [${medicationsData.toString()}],

                  ${user['user_marketingEmail']},
                  ${user['user_marketingText']},

                  ${user['user_agreementAccepted']},

                  15,

                  CURRENT_DATETIME(),
                  CURRENT_DATETIME(),
                  '${user['user_ownerApp']}'
                  )
                `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    const query = `SELECT user_id
                   FROM ${keyDatasetId}.${keyTableId} AS u
                   WHERE u.user_email = '${user['user_email']}'
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      return {
        error: false,
        message: 'Onboarding successfuly',
        data: {
          user_id: rows[0]['user_id']
        }
      }
    } else {
      return {
        error: true,
        message: 'Signup error',
      }
    }
  } else {
    return {
      error: true,
      message: 'Signup error',
    }
  }
}

async function emailVerification(email) {

  // Query
  const query = `SELECT user_id
                 FROM ${keyDatasetId}.${keyTableId} AS u
                 WHERE u.user_email = '${email}'
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
      message: 'Email already exists',
      data: {
        user_id: rows[0]['user_id']
      }
    }
  } else {
    return {
      error: true,
      message: 'Email does not exist',
    }
  }
}

async function usernameVerification(username) {

  // Query
  const query = `SELECT user_userName
                 FROM ${keyDatasetId}.${keyTableId} AS u
                 WHERE u.user_userName = '${username}'
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
      message: 'Username already exists',
      data: {
        user_userName: rows[0]['user_userName']
      }
    }
  } else {
    return {
      error: true,
      message: 'Username does not exist',
    }
  }
}

async function accountValidate(userid) {

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyTableId} AS u
                 SET u.user_validateEmail = TRUE
                 WHERE u.user_id = '${userid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    return {
      error: false,
      message: 'Email validate confirm',
      data: {
        user_validateEmail: true
      }
    }
  } else {
    return {
      error: true,
      message: 'Email does not exist',
    }
  }
}

//BIGQUERY: RestorePassword
async function passwordCodeGenerate(email, code) {

  // Query
  const query = `SELECT user_id
                 FROM ${keyDatasetId}.${keyTableId} AS u
                 WHERE u.user_email = '${email}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    // Query
    const query = `UPDATE ${keyDatasetId}.${keyTableId} AS u
                   SET u.user_restoreCode = ${code}
                   WHERE u.user_email = '${email}'`;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    await bigquery.query(options);

    if (rows) {
      return {
        error: false,
        message: 'Save code restore successfuly',
        data: {
          user_email: email
        }
      }
    } else {
      return {
        error: true,
        message: 'Save code restore error',
      }
    }
  } else {
    return {
      error: true,
      message: 'Email does not exist',
    }
  }

}

async function passwordCodeValidate(email, code) {

  // Query
  const query = `SELECT user_id
                  FROM ${keyDatasetId}.${keyTableId} AS u
                  WHERE u.user_restoreCode = ${code}
                  LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  // Print the results
  console.log(rows)
  console.log('Rows:')
  rows.forEach(row => console.log(row))

  if (rows.length > 0) {
    // Query
    const query = `UPDATE ${keyDatasetId}.${keyTableId} AS u
                   SET u.user_restoreCode = 0
                   WHERE u.user_restoreCode = ${code}`;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    await bigquery.query(options)

    return {
      error: false,
      message: 'Password code validate successfuly',
      data: {
        user_email: email
      }
    }
  } else {
    return {
      error: true,
      message: 'Code Incorrect',
    }
  }

}

async function passwordRestore(email, restore) {

  // Query
  const query = `SELECT user_id
                 FROM ${keyDatasetId}.${keyTableId} AS u
                 WHERE u.user_email = '${email}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {

    // Data
    const salt = await bcrypt.genSalt(10)
    const encryptPassword = await bcrypt.hash(restore, salt)
    // Query
    const query = `UPDATE ${keyDatasetId}.${keyTableId} AS u
                   SET u.user_password = '${encryptPassword}'
                   WHERE u.user_email = '${email}'`;

    const options = {
      query: query,
      location: 'US',
    };

    await bigquery.query(options);

    if (rows) {
      return {
        error: false,
        message: 'Password restored successfuly',
        data: {
          user_id: rows[0]['user_id']
        }
      }
    } else {
      return {
        error: true,
        message: 'Restore password error',
      }
    }
  } else {
    return {
      error: true,
      message: 'Restore password error',
    }
  }
}

module.exports = {
  signIn,
  signUp,
  emailVerification,
  usernameVerification,
  accountValidate,
  passwordCodeGenerate,
  passwordCodeValidate,
  passwordRestore,
}