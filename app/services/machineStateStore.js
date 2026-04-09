import fs from 'node:fs/promises'
import path from 'node:path'

const EMPTY_STATE = {
  version: 1,
  machines: {}
}

function cloneEmptyState () {
  return {
    version: EMPTY_STATE.version,
    machines: {}
  }
}

function safeParseJson (value) {
  try {
    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

class MachineStateStore {
  constructor ({ filePath }) {
    this.filePath = filePath
    this.state = cloneEmptyState()
    this.loaded = false
    this.pendingSave = Promise.resolve()
  }

  async ensureLoaded () {
    if (this.loaded) return

    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = safeParseJson(raw)
      if (parsed && typeof parsed === 'object' && parsed.machines && typeof parsed.machines === 'object') {
        this.state = {
          version: Number(parsed.version || 1),
          machines: parsed.machines
        }
      } else {
        this.state = cloneEmptyState()
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      this.state = cloneEmptyState()
      await this.flush()
    }

    this.loaded = true
  }

  async flush () {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })
    const tempPath = `${this.filePath}.tmp`
    const body = JSON.stringify(this.state, null, 2)
    await fs.writeFile(tempPath, `${body}\n`, 'utf-8')
    await fs.rename(tempPath, this.filePath)
  }

  async save () {
    this.pendingSave = this.pendingSave.then(() => this.flush())
    await this.pendingSave
  }

  async getMachineState (machineId) {
    await this.ensureLoaded()
    const value = this.state.machines?.[machineId]
    if (!value || typeof value !== 'object') return null
    return value
  }

  async setMachineState (machineId, payload) {
    await this.ensureLoaded()
    this.state.machines[machineId] = payload
    await this.save()
  }

  async deleteMachineState (machineId) {
    await this.ensureLoaded()
    if (!this.state.machines[machineId]) return
    delete this.state.machines[machineId]
    await this.save()
  }
}

export function createMachineStateStore ({ filePath }) {
  return new MachineStateStore({ filePath })
}
