import './app/services/env.js'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import express from 'express'
import exphbs from 'express-handlebars'
import { Server as SocketIOServer } from 'socket.io'
import helpers from './app/helpers/index.js'
import { createRouter } from './app/routes/index.js'
import { createFileManager } from './app/services/fileManager.js'
import { createMachineManager } from './app/services/machineManager.js'
import { createPythonBridge } from './app/services/pythonBridge.js'
import { createMachineStateStore } from './app/services/machineStateStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const port = Number(process.env.PORT || 2000)
const isProd = process.env.NODE_ENV === 'PROD'

if (!process.env.SVGDIR) {
  throw new Error('Missing SVGDIR in .env file. Copy .env.example and update it.')
}

const app = express()
const server = http.createServer(app)
const io = new SocketIOServer(server)

const hbs = exphbs.create({
  extname: '.html',
  helpers,
  defaultLayout: false,
  partialsDir: path.join(__dirname, 'app', 'templates', 'includes')
})

app.engine('html', hbs.engine)
app.set('view engine', 'html')
app.set('views', path.join(__dirname, 'app', 'templates'))
app.locals.layout = false

app.use(express.static(path.join(__dirname, 'app', 'public'), {
  etag: true,
  maxAge: isProd ? '1h' : 0
}))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

const fileManager = createFileManager({
  baseDir: process.env.SVGDIR
})
const pythonBridge = createPythonBridge({
  pythonBin: process.env.PYTHON_BIN || 'python3',
  pythonDir: path.join(__dirname, 'python')
})
const machineStateStore = createMachineStateStore({
  filePath: process.env.MACHINE_STATE_FILE || path.join(__dirname, 'data', 'machine-state.json')
})
const machineManager = createMachineManager({
  pythonBridge,
  machineStateStore,
  defaultModel: Number(process.env.DEFAULT_MODEL || 8),
  defaults: {
    speed: Number(process.env.DEFAULT_SPEED || 20),
    handling: Number(process.env.DEFAULT_HANDLING || 1),
    reordering: Number(process.env.DEFAULT_REORDERING || 0),
    penlift: Number(process.env.DEFAULT_PENLIFT || 1),
    webhook: process.env.DEFAULT_WEBHOOK || ''
  },
  virtualMachineEnabled: String(process.env.VIRTUAL_MACHINE || 'true') === 'true',
  virtualMachineName: process.env.VIRTUAL_MACHINE_NAME || 'Virtual Preview Machine',
  virtualMachineCount: (() => {
    const raw = process.env.VIRTUAL_MACHINE_COUNT
    if (raw === undefined || String(raw).trim() === '') return 1
    const n = Number(raw)
    return Number.isFinite(n) ? n : 1
  })()
})

const broadcastEvents = [
  'machines:list',
  'machine:status',
  'preview:result',
  'plot:progress',
  'plot:complete',
  'plot:error'
]
for (const eventName of broadcastEvents) {
  machineManager.on(eventName, (payload) => io.emit(eventName, payload))
}

io.on('connection', async (socket) => {
  socket.emit('machines:list', machineManager.getMachines())
  try {
    const files = await fileManager.list('')
    socket.emit('files:list', files)
  } catch (error) {
    socket.emit('files:error', { message: error.message })
  }
})

app.use('/', createRouter({
  io,
  fileManager,
  machineManager
}))

app.use((req, res) => {
  res.status(404).render('static/404', {
    pageTitle: 'Not Found'
  })
})

// Express only treats this as an error handler when it has 4 parameters.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = Number(err.statusCode || err.status || 500)
  const safeMessage = statusCode >= 500 && isProd ? 'Unexpected server error' : err.message
  if (!isProd) console.error(err)
  if (req.originalUrl.startsWith('/api/')) {
    res.status(statusCode).json({
      ok: false,
      errorMessage: safeMessage
    })
    return
  }
  res.status(statusCode).render('static/500', {
    pageTitle: 'Server Error',
    errorMessage: safeMessage
  })
})

await machineManager.discoverMachines()

server.listen(port, () => {
  console.log(`MVPT v2 listening on port ${port}`)
  console.log(`SVG directory: ${process.env.SVGDIR}`)
})
