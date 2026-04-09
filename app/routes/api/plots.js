import express from 'express'

export function createPlotsApiRouter ({ machineManager }) {
  const router = express.Router()

  router.post('/preview', async (req, res, next) => {
    try {
      const machine = await machineManager.previewPlot({
        machineId: req.body.machineId,
        relativePath: req.body.filePath,
        options: req.body.options || {}
      })
      res.json({ machine })
    } catch (error) {
      next(error)
    }
  })

  router.post('/start', async (req, res, next) => {
    try {
      const machine = await machineManager.startPlot({
        machineId: req.body.machineId,
        relativePath: req.body.filePath,
        options: req.body.options || {}
      })
      res.json({ machine })
    } catch (error) {
      next(error)
    }
  })

  router.post('/start-all', async (req, res, next) => {
    try {
      const results = await machineManager.startPlotOnAll({
        relativePath: req.body.filePath,
        options: req.body.options || {}
      })
      res.json({ results })
    } catch (error) {
      next(error)
    }
  })

  return router
}
