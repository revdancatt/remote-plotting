import { EventEmitter } from 'node:events'
import path from 'node:path'
import { spawn } from 'node:child_process'

function coerceBoolean (value) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return Boolean(value)
}

function parseJsonLine (line) {
  const trimmed = String(line || '').trim()
  if (!trimmed) return null

  const candidates = [trimmed]
  const braceIndex = trimmed.indexOf('{')
  if (braceIndex > 0) candidates.push(trimmed.slice(braceIndex))

  for (const candidate of candidates) {
    if (!candidate.startsWith('{')) continue
    try {
      return JSON.parse(candidate)
    } catch (error) {
      continue
    }
  }
  return null
}

function collectStreamLines (chunk, state, onLine) {
  state.buffer += chunk.toString()
  const lines = state.buffer.split('\n')
  state.buffer = lines.pop() || ''
  for (const line of lines) onLine(line)
}

function summarizeLogs ({ stdoutTextLines, stderrTextLines }) {
  const lines = [
    ...stdoutTextLines.slice(-6).map((line) => `[stdout] ${line}`),
    ...stderrTextLines.slice(-6).map((line) => `[stderr] ${line}`)
  ]
  return lines.join('\n').trim()
}

function pickLastMessage (jsonMessages) {
  if (jsonMessages.length === 0) return null
  return jsonMessages[jsonMessages.length - 1]
}

function extractErrorMessage (message, fallback = '') {
  if (!message || typeof message !== 'object') return fallback
  if (typeof message.error === 'string' && message.error.trim()) return message.error.trim()
  if (typeof message.message === 'string' && message.message.trim()) return message.message.trim()
  return fallback
}

function setupProcessParser (child, onJson) {
  const state = {
    stdout: { buffer: '' },
    stderr: { buffer: '' },
    stdoutTextLines: [],
    stderrTextLines: [],
    jsonMessages: []
  }

  function handleLine (streamName, line) {
    const trimmed = String(line || '').trim()
    if (!trimmed) return
    const parsed = parseJsonLine(trimmed)
    if (parsed && typeof parsed === 'object') {
      state.jsonMessages.push(parsed)
      if (typeof onJson === 'function') onJson(parsed)
      return
    }
    if (streamName === 'stdout') state.stdoutTextLines.push(trimmed)
    else state.stderrTextLines.push(trimmed)
  }

  child.stdout.on('data', (chunk) => {
    collectStreamLines(chunk, state.stdout, (line) => handleLine('stdout', line))
  })

  child.stderr.on('data', (chunk) => {
    collectStreamLines(chunk, state.stderr, (line) => handleLine('stderr', line))
  })

  function flushRemainders () {
    const stdoutRemainder = state.stdout.buffer.trim()
    const stderrRemainder = state.stderr.buffer.trim()
    if (stdoutRemainder) handleLine('stdout', stdoutRemainder)
    if (stderrRemainder) handleLine('stderr', stderrRemainder)
    state.stdout.buffer = ''
    state.stderr.buffer = ''
  }

  return {
    state,
    flushRemainders
  }
}

class PythonBridge {
  constructor ({ pythonBin, pythonDir }) {
    this.pythonBin = pythonBin
    this.pythonDir = pythonDir
  }

  scriptPath (scriptName) {
    return path.join(this.pythonDir, scriptName)
  }

  runScript ({ scriptName, payload = {} }) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.pythonBin, [this.scriptPath(scriptName)], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      const { state, flushRemainders } = setupProcessParser(child)

      child.once('error', reject)
      child.once('close', (code) => {
        flushRemainders()
        const lastMessage = pickLastMessage(state.jsonMessages)
        const logSummary = summarizeLogs(state)

        if (code !== 0) {
          const base = extractErrorMessage(lastMessage, `Python script ${scriptName} exited with code ${code}`)
          reject(new Error(logSummary ? `${base}\n${logSummary}` : base))
          return
        }

        if (!lastMessage) {
          const base = `Python script ${scriptName} returned no JSON messages`
          reject(new Error(logSummary ? `${base}\n${logSummary}` : base))
          return
        }

        if (lastMessage.status === 'error') {
          const base = extractErrorMessage(lastMessage, `Python script ${scriptName} returned an error status`)
          reject(new Error(logSummary ? `${base}\n${logSummary}` : base))
          return
        }

        resolve(lastMessage)
      })

      child.stdin.write(JSON.stringify(payload))
      child.stdin.end()
    })
  }

  spawnScript ({ scriptName, payload = {} }) {
    const emitter = new EventEmitter()
    const child = spawn(this.pythonBin, [this.scriptPath(scriptName)], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const { state, flushRemainders } = setupProcessParser(child, (message) => {
      emitter.emit('json', message)
    })

    child.once('close', (code) => {
      flushRemainders()
      emitter.emit('close', {
        code,
        lastMessage: pickLastMessage(state.jsonMessages),
        stdout: state.stdoutTextLines,
        stderr: state.stderrTextLines
      })
    })

    child.once('error', (error) => {
      emitter.emit('error', error)
    })

    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()

    return { child, emitter }
  }

  async discoverMachines () {
    const result = await this.runScript({
      scriptName: 'discover.py'
    })
    return Array.isArray(result.machines) ? result.machines : []
  }

  async preview (payload) {
    const scriptName = coerceBoolean(payload?.isVirtual) ? 'virtual.py' : 'preview.py'
    const result = await this.runScript({
      scriptName,
      payload: {
        ...payload,
        action: 'preview'
      }
    })
    return result
  }

  spawnPlot (payload) {
    const scriptName = coerceBoolean(payload?.isVirtual) ? 'virtual.py' : 'plot.py'
    return this.spawnScript({
      scriptName,
      payload: {
        ...payload,
        action: 'plot'
      }
    })
  }

  async command (payload) {
    const scriptName = coerceBoolean(payload?.isVirtual) ? 'virtual.py' : 'command.py'
    return this.runScript({
      scriptName,
      payload: {
        ...payload,
        action: 'command'
      }
    })
  }

  async renameMachine (payload) {
    return this.runScript({
      scriptName: 'command.py',
      payload: {
        ...payload,
        action: 'rename'
      }
    })
  }
}

export function createPythonBridge ({ pythonBin, pythonDir }) {
  return new PythonBridge({ pythonBin, pythonDir })
}
