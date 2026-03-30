const { BigQuery } = require('@google-cloud/bigquery');

const { BEANSTALK_GCP_BIGQUERY_PROJECTID, BEANSTALK_GCP_BIGQUERY_DATASETID } = process.env

const keyFilename = "./src/GoogleCloudPlatform/beanstalk-app-13d3f9f5267b.json";
const keyProjectId = BEANSTALK_GCP_BIGQUERY_PROJECTID
const keyDatasetId = BEANSTALK_GCP_BIGQUERY_DATASETID

// Table
const keyTableId = "beanstalk_roles_data";

//Connect BigQuery Client
const bigquery = new BigQuery({ keyProjectId, keyFilename });

//API: Create Role
async function createRole(role) {

  var navigationData = []//("title","type","sub_navigation");
  role['role_navigation'].forEach(navigation => {

    var subNavigationData = []//("title");
    if (navigation['sub_navigation']) {
      navigation['sub_navigation'].forEach(sub_navigation => subNavigationData.push(`STRUCT('${sub_navigation['title']}')`));
    } else {
      subNavigationData.push(`STRUCT(STRING(NULL))`)
    }
    navigationData.push(`('${navigation['title']}',
                            '${navigation['type']}',
                            [${subNavigationData.toString()}]
                         )`)

  });

  // Query
  const query = `INSERT ${keyDatasetId}.${keyTableId} (
                    role_id,
                    role_title,
                    role_navigation
                    )
                  VALUES (
                    GENERATE_UUID(),
                    '${role['role_title']}',
                    [${navigationData.toString()}]
                    )
                `;

  console.log(query)

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    return {
      error: false,
      message: 'Role Created Successfuly',
    }
  } else {
    return {
      error: true,
      message: 'Error Create Role',
    }
  }
}

//API: Navigation Role
async function loadRoleNavigation(dispensaryId) {

  // Table
  const keyDispensariesTableId = "beanstalk_dispensaries_data";

  // Query
  const query = `SELECT d.dispensary_id, d.dispensary_email, d.dispensary_name, d.dispensary_logo, r.role_title as role, r.role_navigation as navigation
                 FROM ${keyDatasetId}.${keyDispensariesTableId} AS d JOIN ${keyDatasetId}.${keyTableId} AS r ON d.dispensary_role_id = r.role_id 
                 WHERE d.dispensary_id = '${dispensaryId}'
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
      message: 'Navigation Successfuly',
      data: {
        navigation: rows[0],
      }
    }

  } else {
    return {
      error: true,
      message: 'Load Navigation Error',
    }
  }
}

//API: Role List
async function loadRoleList() {

  // Query
  const query = `SELECT r.role_id, r.role_title
                 FROM ${keyDatasetId}.${keyTableId} AS r
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
      message: 'Load Role List Successfuly',
      data: {
        Roles: rows,
      }
    }

  } else {
    return {
      error: true,
      message: 'Load Role List Error',
    }
  }
}

//API: Users Role List
async function loadUsersRoleList() {

  // Table
  const keyDispensariesTableId = "beanstalk_dispensaries_data";

  // Query
  const query = `SELECT d.dispensary_id, d.dispensary_email, d.dispensary_name, d.dispensary_logo, d.dispensary_available, r.role_title as role
                   FROM ${keyDatasetId}.${keyDispensariesTableId} AS d JOIN ${keyDatasetId}.${keyTableId} AS r ON d.dispensary_role_id = r.role_id
                   ORDER BY d.dispensary_signupDate ASC`

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows.length > 0) {

    return {
      error: false,
      message: 'Load Users Role List Successfuly',
      data: {
        Users: rows,
      }
    }

  } else {
    return {
      error: true,
      message: 'Load Users Role List Error',
    }
  }
}

//API: Update User Role
async function updateUserRole(userid, update) {

  const updateData = [];

  if (update['dispensary_role_id']) {
    updateData.push(`d.dispensary_role_id = '${update['dispensary_role_id']}'`)
  }

  console.log(updateData)

  // Table
  const keyDispensariesTableId = "beanstalk_dispensaries_data";

  // Query
  const query = `UPDATE ${keyDatasetId}.${keyDispensariesTableId} AS d
                 SET ${updateData}
                 WHERE d.dispensary_id = '${userid}'`;

  const options = {
    query: query,
    location: 'US',
  };

  // Connection
  const [rows] = await bigquery.query(options);

  if (rows) {
    return {
      error: false,
      message: 'Update User Role Successfuly',
    }
  } else {
    return {
      error: true,
      message: 'Update User Role Error',
    }
  }

}

module.exports = {
  createRole,
  loadRoleNavigation,
  loadRoleList,
  loadUsersRoleList,
  updateUserRole
}