
const { BigQuery } = require('@google-cloud/bigquery');

const bcrypt = require('bcryptjs');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = "beanstalk_dispensaries_data";
const keyAccountsTableId = "beanstalk_dispensaries_accounts_data";


//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

async function signinDispensary(email, password) {

  console.log(email)
  // Query
  const query = `SELECT dispensary_id, dispensary_password, dispensary_name, dispensary_email, dispensary_logo
                 FROM ${keyDatasetId}.${keyTableId} AS d
                 WHERE d.dispensary_email = '${email}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    const login = bcrypt.compareSync(`${password}`, rows[0]['dispensary_password'])
    if (login) {

      const queryUpdate = `UPDATE ${keyDatasetId}.${keyTableId} AS d
                           SET d.dispensary_lastLogin = CURRENT_DATETIME()
                           WHERE d.dispensary_email = '${email}'`;

      const optionsUpdate = {
        query: queryUpdate,
        location: 'US',
      };

      await bigquery.query(optionsUpdate);

      return {
        error: false,
        message: 'Login successfuly',
        data: {
          dispensaryId: rows[0]['dispensary_id'],
          dispensaryName: rows[0]['dispensary_name'],
          dispensaryEmail: rows[0]['dispensary_email'],
          dispensaryLogo: rows[0]['dispensary_logo'],
          dispensaryType: "main"
        }
      }
    } else {
      return {
        error: true,
        message: 'Incorrect password',
      }
    }
  } else {
    // Query
    const query = `SELECT d.dispensary_id, d.dispensary_name, d.dispensary_email, d.dispensary_logo, a.dispensary_account_id, a.dispensary_account_password, a.dispensary_account_fullname, a.dispensary_account_email
                   FROM ${keyDatasetId}.${keyAccountsTableId} AS a JOIN ${keyDatasetId}.${keyTableId} AS d
                   ON a.dispensary_id = d.dispensary_id
                   WHERE a.dispensary_account_email = '${email}'
                   LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rowsAccount] = await bigquery.query(options);
    if (rowsAccount.length > 0) {
      const login = bcrypt.compareSync(`${password}`, rowsAccount[0]['dispensary_account_password'])
      if (login) {

        const queryUpdate = `UPDATE ${keyDatasetId}.${keyAccountsTableId} AS a
                           SET a.dispensary_account_lastLogin = CURRENT_DATETIME()
                           WHERE a.dispensary_account_email = '${email}'`;

        const optionsUpdate = {
          query: queryUpdate,
          location: 'US',
        };

        await bigquery.query(optionsUpdate);

        return {
          error: false,
          message: 'Login successfuly',
          data: {
            dispensaryId: rowsAccount[0]['dispensary_id'],
            dispensaryName: rowsAccount[0]['dispensary_name'],
            dispensaryEmail: rowsAccount[0]['dispensary_email'],
            dispensaryLogo: rowsAccount[0]['dispensary_logo'],
            dispensaryType: "secondary",
            accountId: rowsAccount[0]['dispensary_account_id'],
            accountUsername: rowsAccount[0]['dispensary_account_fullname'],
            accountEmail: rowsAccount[0]['dispensary_account_email'],
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
}

async function signupDispensary(dispensary) {

  // Data
  const salt = await bcrypt.genSalt(10)
  const encryptPassword = await bcrypt.hash(dispensary['dispensary_password'], salt)

  const roleId = "38d59c97-b9d6-4786-a47d-7f49cb5d422c"

  var storesData = []//("store_id");
  if (dispensary['dispensary_stores']) {
    dispensary['dispensary_stores'].forEach(store => storesData.push(`STRUCT('${store}')`));
  }
  // Query
  const query = `INSERT ${keyDatasetId}.${keyTableId} (
                  dispensary_id,
                  dispensary_email,
                  dispensary_password,

                  dispensary_license,
                  dispensary_name,
                  dispensary_description,
                  dispensary_logo,

                  dispensary_stores,

                  dispensary_agreementAccepted,

                  dispensary_available,

                  dispensary_signupDate,
                  dispensary_lastLogin,
                  dispensary_ownerApp,
                  dispensary_role_id
                  )
                VALUES (
                  GENERATE_UUID(),
                  '${dispensary['dispensary_email']}',
                  '${encryptPassword}',
                  
                  '${dispensary['dispensary_license']}',
                  '${dispensary['dispensary_name']}',
                  '${dispensary['dispensary_description']}',
                  '${dispensary['dispensary_logo']}',
                  
                  [${storesData.toString()}],

                  ${dispensary['dispensary_agreementAccepted']},

                  ${dispensary['dispensary_available']},

                  CURRENT_DATETIME(),
                  CURRENT_DATETIME(),
                  '${dispensary['dispensary_ownerApp']}',
                  '${roleId}'
                  )
                `;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    const query = `SELECT dispensary_id, dispensary_name, dispensary_email, dispensary_logo
                   FROM ${keyDatasetId}.${keyTableId} AS d
                   WHERE d.dispensary_email = '${dispensary['dispensary_email']}'
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
          dispensaryId: rows[0]['dispensary_id'],
          dispensaryName: rows[0]['dispensary_name'],
          dispensaryEmail: rows[0]['dispensary_email'],
          dispensaryLogo: rows[0]['dispensary_logo'],
          dispensaryType: "main"
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

async function emailVerificationDispensary(email) {

  // Query
  const query = `SELECT dispensary_id
                 FROM ${keyDatasetId}.${keyTableId} AS d
                 WHERE d.dispensary_email = '${email}'
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
        dispensary_id: rows[0]['dispensary_id']
      }
    }
  } else {

    // Query
    const query = `SELECT dispensary_account_id
                    FROM ${keyDatasetId}.${keyAccountsTableId} AS a
                    WHERE a.dispensary_account_email = '${email}'
                    LIMIT 1`;

    const options = {
      query: query,
      location: 'US',
    };

    // Connection
    const [rowsSecondaryAccount] = await bigquery.query(options);


    if (rowsSecondaryAccount.length > 0) {
      return {
        error: false,
        message: 'Email already exists',
        data: {
          dispensary_id: rowsSecondaryAccount[0]['dispensary_account_id']
        }
      }

    } else {
      return {
        error: true,
        message: 'Email does not exist',
      }
    }
  }
}

async function accountValidateDispensary(dispensaryid) {

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyTableId} AS d
                 SET d.dispensary_validateEmail = TRUE
                 WHERE d.dispensary_id = '${dispensaryid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    return {
      error: false,
      message: 'Email validate confirm',
      data: {
        dispensary_validateEmail: true
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
async function passwordCodeGenerateDispensary(email, code) {

  // Query
  const query = `SELECT dispensary_id
                 FROM ${keyDatasetId}.${keyTableId} AS d
                 WHERE d.dispensary_email = '${email}'
                 LIMIT 1`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {
    // Query
    const query = `UPDATE ${keyDatasetId}.${keyTableId} AS d
                   SET d.dispensary_restoreCode = ${code}
                   WHERE d.dispensary_email = '${email}'`;

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
          dispensary_email: email
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

async function passwordCodeValidateDispensary(email, code) {

  // Query
  const query = `SELECT dispensary_id
                  FROM ${keyDatasetId}.${keyTableId} AS d
                  WHERE d.dispensary_restoreCode = ${code}
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
    const query = `UPDATE ${keyDatasetId}.${keyTableId} AS d
                   SET d.dispensary_restoreCode = 0
                   WHERE d.dispensary_restoreCode = ${code}`;

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
        dispensary_email: email
      }
    }
  } else {
    return {
      error: true,
      message: 'Code Incorrect',
    }
  }

}

async function passwordRestoreDispensary(email, restore) {

  // Query
  const query = `SELECT dispensary_id
                 FROM ${keyDatasetId}.${keyTableId} AS d
                 WHERE d.dispensary_email = '${email}'
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
    const query = `UPDATE ${keyDatasetId}.${keyTableId} AS d
                   SET d.dispensary_password = '${encryptPassword}'
                   WHERE d.dispensary_email = '${email}'`;

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
          dispensary_id: rows[0]['dispensary_id']
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
  //Authentication
  signinDispensary,
  signupDispensary,
  emailVerificationDispensary,
  accountValidateDispensary,
  //RestorePassword
  passwordCodeGenerateDispensary,
  passwordCodeValidateDispensary,
  passwordRestoreDispensary,
  //SecondaryAccount
}