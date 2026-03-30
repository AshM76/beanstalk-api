const { check, validationResult } = require('express-validator')
const rolesConnection = require('../../../GoogleCloudPlatform/Connections/GCP-BigQuery_connection_roles')

//API: Create Role
async function createRole(req, res) {
    console.log(':: POST')
    console.log(':: API/createRole')
  
    console.log(req.body)

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: true, message: errors.array() });
    }

    let role = req.body
  
    const result = await rolesConnection.createRole(role)
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

//API: Role Navigation
async function loadRoleNavigation(req, res) {
  console.log(':: GET')
  console.log(':: API/loadNavigation')
  console.log(`:: dispensaryId: ${req.params.dispensaryId}`)

  let dispensaryId = req.params.dispensaryId;

  const result = await rolesConnection.loadRoleNavigation(dispensaryId);
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

//API: Role List
async function loadRoleList(req, res) {
  console.log(':: GET')
  console.log(':: API/RoleList')

  const result = await rolesConnection.loadRoleList();
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

//API: Users Role List
async function loadUsersRoleList(req, res) {
  console.log(':: GET')
  console.log(':: API/UsersRoleList')

  const result = await rolesConnection.loadUsersRoleList();
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

//API: User Update Role
async function updateUserRole(req, res) {
  console.log(':: PUT')
  console.log(':: API/UpdateUserRole')
  console.log(`:: userid: ${req.params.userid}`)
  console.log(req.body)

  let userid = req.params.userid
  let update = req.body

  const result = await rolesConnection.updateUserRole(userid, update);
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


let validationRole = [
  check('role_title').not().isEmpty().withMessage('[role_title] is a required field.'),
  check('role_navigation').not().isEmpty().withMessage('[role_navigation] is a required field.'),
]

module.exports = {
    createRole,
    loadRoleNavigation,
    loadRoleList,
    loadUsersRoleList,
    updateUserRole,
    validationRole
 }