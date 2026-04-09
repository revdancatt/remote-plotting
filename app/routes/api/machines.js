import express from 'express'

export function createMachinesApiRouter ({ machineManager }) {
  const router = express.Router()

  router.get('/', (req, res) => {
    res.json({
      machines: machineManager.getMachines()
    })
  })

  router.get('/:machineId', (req, res, next) => {
    try {
      const machine = machineManager.getMachine(req.params.machineId)
      res.json({ machine })
    } catch (error) {
      next(error)
    }
  })

  router.post('/discover', async (req, res, next) => {
    try {
      const machines = await machineManager.discoverMachines()
      res.json({ machines })
    } catch (error) {
      next(error)
    }
  })

  router.post('/:machineId/rename', async (req, res, next) => {
    try {
      const machine = await machineManager.renameMachine(req.params.machineId, req.body.name)
      res.json({ machine })
    } catch (error) {
      next(error)
    }
  })

  router.post('/:machineId/command', async (req, res, next) => {
    try {
      const result = await machineManager.runCommand(req.params.machineId, req.body.command)
      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  router.put('/:machineId/options', async (req, res, next) => {
    try {
      const machine = await machineManager.setMachineOptions(req.params.machineId, req.body || {})
      res.json({ machine })
    } catch (error) {
      next(error)
    }
  })

  router.post('/:machineId/dismiss-panel', async (req, res, next) => {
    try {
      const machine = await machineManager.dismissPanel(req.params.machineId)
      res.json({ machine })
    } catch (error) {
      next(error)
    }
  })

  return router
}
