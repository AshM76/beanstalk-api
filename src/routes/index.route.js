const { Router } = require('express')
const router = Router()
const path = require('path')

router.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), './src/public/coverpage.html'))
})

module.exports = router