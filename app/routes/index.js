const express = require('express')
const router = express.Router()

const main = require('./main')

router.use(function (req, res, next) {
  req.templateValues = {}

  const d = new Date()
  req.templateValues.today = {
    day: d.getDate(),
    month: d.getMonth() + 1
  }
  next()
})

router.get('/', main.index)
router.post('/', main.index)
router.get('/:svgfile', main.index)
router.post('/:svgfile', main.index)

module.exports = router
