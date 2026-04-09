import express from 'express'
import multer from 'multer'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
})

export function createFilesApiRouter ({ fileManager }) {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    try {
      const dir = String(req.query.dir || '')
      const files = await fileManager.list(dir)
      res.json(files)
    } catch (error) {
      next(error)
    }
  })

  router.get('/content', async (req, res, next) => {
    try {
      const relativePath = String(req.query.path || '')
      if (!relativePath) throw new Error('Missing path')
      const absolutePath = fileManager.resolveSafePath(relativePath)
      res.sendFile(absolutePath)
    } catch (error) {
      next(error)
    }
  })

  router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw new Error('No file uploaded')
      const uploaded = await fileManager.saveUploadedFile({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        relativeDir: req.body.dir || ''
      })
      res.json({
        ok: true,
        file: uploaded
      })
    } catch (error) {
      next(error)
    }
  })

  router.delete('/', async (req, res, next) => {
    try {
      const relativePath = String(req.query.path || '')
      if (!relativePath) throw new Error('Missing path')
      await fileManager.deleteFile(relativePath)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  router.post('/mkdir', async (req, res, next) => {
    try {
      const directory = await fileManager.createDirectory({
        dir: req.body.dir || '',
        name: req.body.name || ''
      })
      res.json({
        ok: true,
        directory
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
