import { EventEmitter } from 'node:events'
import crypto from 'node:crypto'

function machineIdFromPort (port = '') {
  return crypto.createHash('md5').update(String(port)).digest('hex').slice(0, 12)
}

function clamp (value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeOptions (options, defaults) {
  return {
    speed: clamp(Number(options?.speed ?? defaults.speed), 1, 100),
    handling: clamp(Number(options?.handling ?? defaults.handling), 1, 4),
    reordering: clamp(Number(options?.reordering ?? defaults.reordering), 0, 4),
    penlift: clamp(Number(options?.penlift ?? defaults.penlift), 1, 3),
    randomStart: Boolean(options?.randomStart),
    hiding: Boolean(options?.hiding),
    model: clamp(Number(options?.model ?? defaults.model), 1, 10),
    webhook: String(options?.webhook ?? defaults.webhook ?? '').trim()
  }
}

function hasOptionValues (options) {
  return Boolean(options && typeof options === 'object' && Object.keys(options).length > 0)
}

function assertRelativePath (relativePath) {
  const value = String(relativePath || '').trim()
  if (!value) {
    const error = new Error('filePath is required')
    error.statusCode = 400
    throw error
  }
  return value
}

class MachineManager extends EventEmitter {
  constructor ({
    pythonBridge,
    machineStateStore,
    defaultModel,
    defaults,
    virtualMachineEnabled,
    virtualMachineName,
    virtualMachineCount
  }) {
    super()
    this.pythonBridge = pythonBridge
    this.machineStateStore = machineStateStore
    this.defaultModel = defaultModel
    this.defaults = {
      ...defaults,
      model: defaultModel
    }
    this.virtualMachineEnabled = virtualMachineEnabled
    this.virtualMachineName = virtualMachineName
    this.virtualMachineCount = Math.min(5, Math.max(1, Number(virtualMachineCount ?? 1)))
    this.machines = new Map()
    this.activePlots = new Map()
  }

  toPublicMachine (machine) {
    return {
      id: machine.id,
      name: machine.name,
      displayName: machine.displayName,
      port: machine.port,
      model: machine.model,
      isVirtual: machine.isVirtual,
      status: machine.status,
      currentFile: machine.currentFile || null,
      preview: machine.preview || null,
      options: machine.options
    }
  }

  getMachineOrThrow (machineId) {
    const machine = this.machines.get(machineId)
    if (!machine) {
      const error = new Error('Machine not found')
      error.statusCode = 404
      throw error
    }
    return machine
  }

  getMachine (machineId) {
    const machine = this.getMachineOrThrow(machineId)
    return this.toPublicMachine(machine)
  }

  getMachines () {
    return [...this.machines.values()]
      .map((machine) => this.toPublicMachine(machine))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  emitMachinesList () {
    this.emit('machines:list', this.getMachines())
  }

  async hydrateMachineState (machineId) {
    if (!this.machineStateStore) return null
    return this.machineStateStore.getMachineState(machineId)
  }

  async persistMachineState (machine) {
    if (!this.machineStateStore) return
    await this.machineStateStore.setMachineState(machine.id, {
      displayName: machine.displayName,
      options: machine.options
    })
  }

  async discoverMachines () {
    let discovered = []
    try {
      discovered = await this.pythonBridge.discoverMachines()
    } catch (error) {
      discovered = []
    }
    const nextMachines = new Map()

    for (const machine of discovered) {
      const port = String(machine.port || machine.name || '')
      const id = `machine-${machineIdFromPort(port)}`
      const existing = this.machines.get(id)
      const persisted = await this.hydrateMachineState(id)
      nextMachines.set(id, {
        id,
        name: String(machine.name || port || 'NextDraw'),
        displayName: persisted?.displayName || existing?.displayName || String(machine.name || port || 'NextDraw'),
        port,
        model: Number(machine.model || this.defaultModel),
        isVirtual: false,
        status: existing?.status || 'idle',
        currentFile: existing?.currentFile || null,
        preview: existing?.preview || null,
        options: normalizeOptions(persisted?.options || existing?.options, this.defaults)
      })
    }

    if (this.virtualMachineEnabled) {
      const count = this.virtualMachineCount
      for (let i = 0; i < count; i++) {
        const virtualId = i === 0 ? 'virtual-machine' : `virtual-machine-${i + 1}`
        const existing = this.machines.get(virtualId)
        const persisted = await this.hydrateMachineState(virtualId)
        const defaultDisplay =
          count === 1
            ? this.virtualMachineName
            : `${this.virtualMachineName} ${i + 1}`.trim()
        nextMachines.set(virtualId, {
          id: virtualId,
          name: defaultDisplay,
          displayName: persisted?.displayName || existing?.displayName || defaultDisplay,
          port: 'virtual://preview-only',
          model: Number(this.defaultModel),
          isVirtual: true,
          status: existing?.status || 'idle',
          currentFile: existing?.currentFile || null,
          preview: existing?.preview || null,
          options: normalizeOptions(persisted?.options || existing?.options, this.defaults)
        })
      }
    }

    this.machines = nextMachines
    this.emitMachinesList()
    return this.getMachines()
  }

  async renameMachine (machineId, newName) {
    const trimmedName = String(newName || '').trim()
    if (!trimmedName) {
      const error = new Error('Name is required')
      error.statusCode = 400
      throw error
    }
    const machine = this.getMachineOrThrow(machineId)
    if (!machine.isVirtual) {
      await this.pythonBridge.renameMachine({
        port: machine.port,
        name: trimmedName
      })
    }
    machine.displayName = trimmedName
    await this.persistMachineState(machine)
    this.emit('machine:status', this.toPublicMachine(machine))
    this.emitMachinesList()
    return this.toPublicMachine(machine)
  }

  async setMachineOptions (machineId, options = {}) {
    const machine = this.getMachineOrThrow(machineId)
    machine.options = normalizeOptions(options, this.defaults)
    await this.persistMachineState(machine)
    this.emit('machine:status', this.toPublicMachine(machine))
    this.emitMachinesList()
    return this.toPublicMachine(machine)
  }

  /** After plot complete/error UI, return to a normal editable state (keeps preview & options). */
  async dismissPanel (machineId) {
    const machine = this.getMachineOrThrow(machineId)
    let changed = false
    if (machine.status === 'complete') {
      machine.status = machine.preview ? 'ready' : 'idle'
      changed = true
    } else if (machine.status === 'error') {
      machine.status = 'idle'
      delete machine.errorMessage
      changed = true
    }
    if (changed) {
      this.emit('machine:status', this.toPublicMachine(machine))
      this.emitMachinesList()
    }
    return this.toPublicMachine(machine)
  }

  async runCommand (machineId, command) {
    const machine = this.getMachineOrThrow(machineId)
    const result = await this.pythonBridge.command({
      isVirtual: machine.isVirtual,
      port: machine.port,
      command,
      model: machine.options.model
    })
    machine.status = 'idle'
    this.emit('machine:status', this.toPublicMachine(machine))
    return result
  }

  async previewPlot ({ machineId, relativePath, options = {} }) {
    const safePath = assertRelativePath(relativePath)
    const machine = this.getMachineOrThrow(machineId)
    machine.status = 'previewing'
    machine.currentFile = safePath
    machine.options = hasOptionValues(options)
      ? normalizeOptions(options, this.defaults)
      : normalizeOptions(machine.options, this.defaults)
    await this.persistMachineState(machine)
    this.emit('machine:status', this.toPublicMachine(machine))

    const previewResult = await this.pythonBridge.preview({
      isVirtual: machine.isVirtual,
      port: machine.port,
      model: machine.options.model,
      filePath: safePath,
      options: machine.options
    })

    machine.preview = {
      timeEstimate: Number(previewResult.timeEstimate || 0),
      distancePenDown: Number(previewResult.distancePenDown || 0),
      distanceTotal: Number(previewResult.distanceTotal || 0),
      penLifts: Number(previewResult.penLifts || 0),
      generatedAt: new Date().toISOString()
    }
    machine.status = 'ready'

    this.emit('preview:result', {
      machineId: machine.id,
      preview: machine.preview
    })
    this.emit('machine:status', this.toPublicMachine(machine))
    return this.toPublicMachine(machine)
  }

  startProgressTicker (machine) {
    const activePlot = this.activePlots.get(machine.id)
    if (!activePlot) return

    const tick = () => {
      const ap = this.activePlots.get(machine.id)
      if (!ap) return

      /* Python runs estimate_plot_time() before emitting { status: 'started' } — that prep
         must not advance the ring or zero out the countdown (it looked like "100% done"). */
      if (ap.plotStartedAt == null) {
        const previewSec = Number(machine.preview?.timeEstimate)
        const tentative =
          Number.isFinite(previewSec) && previewSec > 0 ? previewSec : null
        this.emit('plot:progress', {
          machineId: machine.id,
          preparing: true,
          percent: 0,
          remaining: tentative,
          endTime: null
        })
        return
      }

      const estimateSeconds = Math.max(1, Number(ap.estimateSeconds || 1))
      const elapsedMs = Date.now() - ap.plotStartedAt
      const elapsed = Math.floor(elapsedMs / 1000)
      const remaining = Math.max(0, Math.ceil(estimateSeconds - elapsed))
      const percent = clamp((elapsed / estimateSeconds) * 100, 0, 99.9)

      this.emit('plot:progress', {
        machineId: machine.id,
        preparing: false,
        percent,
        elapsed,
        remaining,
        endTime: new Date(ap.plotStartedAt + estimateSeconds * 1000).toISOString()
      })
    }

    tick()
    const intervalId = setInterval(tick, 1000)
    activePlot.intervalId = intervalId
  }

  finalizePlot (machineId, status, payload = {}) {
    const activePlot = this.activePlots.get(machineId)
    if (!activePlot) return
    if (activePlot.intervalId) clearInterval(activePlot.intervalId)
    this.activePlots.delete(machineId)

    const machine = this.machines.get(machineId)
    if (!machine) return
    machine.status = status
    this.emit('machine:status', this.toPublicMachine(machine))

    if (status === 'complete') {
      this.emit('plot:complete', {
        machineId,
        ...payload
      })
      return
    }
    this.emit('plot:error', {
      machineId,
      ...payload
    })
  }

  async startPlot ({ machineId, relativePath, options = {} }) {
    const safePath = assertRelativePath(relativePath)
    const machine = this.getMachineOrThrow(machineId)
    if (this.activePlots.has(machine.id)) {
      const error = new Error('Machine is already plotting')
      error.statusCode = 409
      throw error
    }

    machine.currentFile = safePath
    machine.options = hasOptionValues(options)
      ? normalizeOptions(options, this.defaults)
      : normalizeOptions(machine.options, this.defaults)
    await this.persistMachineState(machine)
    machine.status = 'plotting'
    this.emit('machine:status', this.toPublicMachine(machine))

    const estimateSeconds = Math.max(
      1,
      Number(machine.preview?.timeEstimate || options?.timeEstimate || 1)
    )

    const activePlot = {
      plotStartedAt: null,
      estimateSeconds,
      intervalId: null
    }
    this.activePlots.set(machine.id, activePlot)
    this.startProgressTicker(machine)

    const { emitter } = this.pythonBridge.spawnPlot({
      isVirtual: machine.isVirtual,
      port: machine.port,
      model: machine.options.model,
      filePath: safePath,
      options: machine.options
    })

    emitter.on('json', (message) => {
      if (message.status === 'started') {
        const latest = this.activePlots.get(machine.id)
        if (latest) {
          const te = Number(message.timeEstimate)
          if (Number.isFinite(te) && te >= 0) {
            latest.estimateSeconds = Math.max(1, te)
          }
          if (latest.plotStartedAt == null) {
            latest.plotStartedAt = Date.now()
          }
        }
      }
      if (message.status === 'complete') {
        this.finalizePlot(machine.id, 'complete', {
          timeElapsed: Number(message.timeElapsed || 0)
        })
      }
      if (message.status === 'error') {
        this.finalizePlot(machine.id, 'error', {
          error: message.error || 'Plot failed'
        })
      }
    })

    emitter.on('close', ({ code, stdout = [], stderr = [] }) => {
      if (code !== 0) {
        const combined = [...stdout, ...stderr].join('\n').trim()
        this.finalizePlot(machine.id, 'error', {
          error: combined || `Plot process exited with code ${code}`
        })
      }
    })

    emitter.on('error', (error) => {
      this.finalizePlot(machine.id, 'error', {
        error: error.message
      })
    })

    return this.toPublicMachine(machine)
  }

  async startPlotOnAll ({ relativePath, options = {} }) {
    const safePath = assertRelativePath(relativePath)
    const machines = this.getMachines().filter((machine) => machine.status !== 'plotting')
    const results = []
    for (const machine of machines) {
      try {
        const started = await this.startPlot({
          machineId: machine.id,
          relativePath: safePath,
          options
        })
        results.push({
          machineId: machine.id,
          ok: true,
          machine: started
        })
      } catch (error) {
        results.push({
          machineId: machine.id,
          ok: false,
          error: error.message
        })
      }
    }
    return results
  }
}

export function createMachineManager (config) {
  return new MachineManager(config)
}
