import express from 'express'
import { createPagesRouter } from './pages.js'
import { createMachinesApiRouter } from './api/machines.js'
import { createFilesApiRouter } from './api/files.js'
import { createPlotsApiRouter } from './api/plots.js'

export function createRouter ({ io, fileManager, machineManager }) {
  const router = express.Router()

  router.use((req, res, next) => {
    res.locals.pageTitle = 'MVPT v2'
    next()
  })

  router.use('/', createPagesRouter({
    fileManager,
    machineManager
  }))
  router.use('/api/machines', createMachinesApiRouter({ machineManager }))
  router.use('/api/files', createFilesApiRouter({ fileManager }))
  router.use('/api/plots', createPlotsApiRouter({ machineManager, io }))

  return router
}
