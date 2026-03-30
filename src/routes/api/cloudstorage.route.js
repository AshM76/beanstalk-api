const { Router } = require('express')
const router = Router()

const upload = require('../../GoogleCloudPlatform/CloudStorage/storage.controller')

//API: Cloud Storage
router.post('/cloudstorage/upload', upload.uploadFile )

module.exports = router