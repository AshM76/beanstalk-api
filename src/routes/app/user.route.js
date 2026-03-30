const { Router } = require('express')
const router = Router()

const userCtrl = require('../../controllers/app/user/user.controller')
const auth = require('../../middlewares/auth.middleware')

//API: User
router.get('/user/profile/:userid', userCtrl.userProfile)
router.put('/user/profile/:userid', userCtrl.updateUserProfile)
//API: User Load Data
router.get('/user/data/:userid',auth ,userCtrl.loadProfileData)

module.exports = router