import express from 'express'
import { MODEL_OPTIONS } from '../public/js/modelOptions.js'

export function createPagesRouter ({ fileManager, machineManager }) {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    try {
      const requestedDir = String(req.query.dir || '')
      const files = await fileManager.list(requestedDir)
      await machineManager.discoverMachines()
      const machines = machineManager.getMachines()

      res.render('dashboard', {
        pageTitle: 'MVPT v2 Dashboard',
        files,
        machines,
        modelOptions: MODEL_OPTIONS,
        initialState: JSON.stringify({
          files,
          machines
        })
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
