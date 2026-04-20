import { initThemeManager } from './themeManager.js'
import { initPartyCursor } from './partyCursor.js'
import { initFileBrowser } from './fileBrowser.js'
import { machinePanelTemplate, collectPanelOptions, patchPanel } from './machinePanel.js'
import { updateGlanceableProgress } from './plotProgress.js'
import { toastError, toastSuccess, toastInfo, toastWarning } from './toast.js'

const socket = window.io()
const machineGrid = document.getElementById('machine-grid')
const machineCount = document.getElementById('machine-count')
const discoverButton = document.getElementById('discover-machines')
const plotAllButton = document.getElementById('plot-all')

const state = {
  files: window.__MVPT_INITIAL_STATE__?.files || {},
  machines: window.__MVPT_INITIAL_STATE__?.machines || [],
  /** machineId -> relative path for the SVG assigned to that machine */
  selectedFiles: {},
  /** Machine that receives the next library pick & whose file is highlighted */
  activeMachineId: null
}

/* ─── State helpers ─── */

function findMachineIndex (machineId) {
  return state.machines.findIndex((m) => m.id === machineId)
}

function upsertMachine (machine) {
  const i = findMachineIndex(machine.id)
  if (i === -1) state.machines.push(machine)
  else state.machines[i] = machine
}

/* ─── Smart DOM rendering ─── */

function currentPanelIds () {
  return Array.from(machineGrid.querySelectorAll('.machine-panel'))
    .map((el) => el.dataset.machineId)
}

function getMachineDisplayName (machineId) {
  const m = state.machines.find((x) => x.id === machineId)
  return m?.displayName || machineId
}

function updateSidebarFooter () {
  const targetEl = document.getElementById('file-browser-target-name')
  const fileEl = document.getElementById('selected-file-name')
  if (targetEl) {
    targetEl.textContent = state.activeMachineId
      ? getMachineDisplayName(state.activeMachineId)
      : '—'
  }
  if (fileEl) {
    const path = state.activeMachineId
      ? state.selectedFiles[state.activeMachineId]
      : null
    fileEl.textContent = path || 'No file for this machine'
  }
}

function updateMachinePanelSvgPreview (machineId) {
  const panel = machineGrid.querySelector(
    `.machine-panel[data-machine-id="${window.CSS.escape(machineId)}"]`
  )
  if (!panel) return
  const path = state.selectedFiles[machineId]
  const inner = panel.querySelector('[data-role="svg-preview-inner"]')
  const img = panel.querySelector('[data-role="svg-preview-img"]')
  const cap = panel.querySelector('[data-role="svg-preview-caption"]')
  if (!inner || !img || !cap) return
  if (path) {
    img.src = `/api/files/content?path=${encodeURIComponent(path)}`
    img.alt = path
    cap.textContent = path.split('/').pop()
    inner.classList.remove('hidden')
  } else {
    img.src = ''
    img.alt = ''
    cap.textContent = ''
    inner.classList.add('hidden')
  }
}

function setActiveMachine (machineId) {
  if (!machineId) return
  state.activeMachineId = machineId
  machineGrid.querySelectorAll('.machine-panel').forEach((p) => {
    p.classList.toggle('machine-panel--active', p.dataset.machineId === machineId)
  })
  updateSidebarFooter()
  fileBrowser.syncHighlight()
}

function renderMachines () {
  machineGrid.innerHTML = state.machines.map(machinePanelTemplate).join('')
  machineCount.textContent = String(state.machines.length)
  const ids = new Set(state.machines.map((m) => m.id))
  if (!state.activeMachineId || !ids.has(state.activeMachineId)) {
    state.activeMachineId = state.machines[0]?.id || null
  }
  state.machines.forEach((m) => updateMachinePanelSvgPreview(m.id))
  machineGrid.querySelectorAll('.machine-panel').forEach((p) => {
    p.classList.toggle('machine-panel--active', p.dataset.machineId === state.activeMachineId)
  })
  updateSidebarFooter()
  fileBrowser.syncHighlight()
}

function syncMachineGrid () {
  const existingIds = new Set(currentPanelIds())
  const newIds = new Set(state.machines.map((m) => m.id))

  if (existingIds.size !== newIds.size || ![...existingIds].every((id) => newIds.has(id))) {
    renderMachines()
    return
  }

  for (const machine of state.machines) {
    const panel = machineGrid.querySelector(`.machine-panel[data-machine-id="${window.CSS.escape(machine.id)}"]`)
    if (panel) patchPanel(panel, machine)
  }
  machineCount.textContent = String(state.machines.length)
}

function updateSinglePanel (machine) {
  const panel = machineGrid.querySelector(`.machine-panel[data-machine-id="${window.CSS.escape(machine.id)}"]`)
  if (panel) {
    patchPanel(panel, machine)
  } else {
    machineGrid.insertAdjacentHTML('beforeend', machinePanelTemplate(machine))
  }
}

/* ─── API helper ─── */

async function callJson (url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.errorMessage || data.message || 'Request failed')
  return data
}

function getSelectedFileForMachineOrWarn (machineId) {
  const path = state.selectedFiles[machineId]
  if (!path) {
    toastWarning('Select an SVG for this machine in the library (choose the machine, then a file).')
    return null
  }
  return path
}

function getPanelMachine (panelElement) {
  const machineId = panelElement.dataset.machineId
  return state.machines.find((m) => m.id === machineId)
}

/* ─── Persist plot options per machine (PUT /api/machines/:id/options) ─── */

const OPTION_SAVE_DEBOUNCE_MS = 450
const optionSaveTimers = new WeakMap()

function clearOptionSaveTimer (panel) {
  const t = optionSaveTimers.get(panel)
  if (t) clearTimeout(t)
  optionSaveTimers.delete(panel)
}

function schedulePersistMachineOptions (panel, delayMs) {
  clearOptionSaveTimer(panel)
  if (delayMs <= 0) {
    persistMachineOptions(panel)
    return
  }
  const id = setTimeout(() => {
    optionSaveTimers.delete(panel)
    persistMachineOptions(panel)
  }, delayMs)
  optionSaveTimers.set(panel, id)
}

async function persistMachineOptions (panel) {
  const status = panel.dataset.status
  if (status === 'plotting' || status === 'previewing') return

  const machineId = panel.dataset.machineId
  const options = collectPanelOptions(panel)
  try {
    const data = await callJson(`/api/machines/${encodeURIComponent(machineId)}/options`, {
      method: 'PUT',
      body: JSON.stringify(options)
    })
    if (data.machine) {
      upsertMachine(data.machine)
      updateSinglePanel(data.machine)
    }
  } catch (error) {
    toastError(error.message)
  }
}

machineGrid.addEventListener('change', (event) => {
  const el = event.target
  const config = el.closest('[data-role="plot-config"]')
  if (!config || !config.contains(el)) return
  const panel = el.closest('.machine-panel')
  if (!panel) return

  if (el.matches('select') || el.matches('input[type="checkbox"]')) {
    schedulePersistMachineOptions(panel, 0)
  } else if (el.matches('input[name="speed"]')) {
    schedulePersistMachineOptions(panel, 0)
  }
})

machineGrid.addEventListener('input', (event) => {
  const el = event.target
  if (el.name !== 'webhook' && el.name !== 'speed') return
  const config = el.closest('[data-role="plot-config"]')
  if (!config || !config.contains(el)) return
  const panel = el.closest('.machine-panel')
  if (!panel) return
  schedulePersistMachineOptions(panel, OPTION_SAVE_DEBOUNCE_MS)
})

/* ─── Click machine panel to set active "window" (file assignment target) ─── */

machineGrid.addEventListener('click', (event) => {
  const panel = event.target.closest('.machine-panel')
  if (!panel) return
  if (event.target.closest('button, input, select, textarea, a, label')) return
  setActiveMachine(panel.dataset.machineId)
})

/* ─── Click delegation on machine panels ─── */

document.addEventListener('click', async (event) => {
  const panel = event.target.closest('.machine-panel')
  if (!panel) return

  const machine = getPanelMachine(panel)
  if (!machine) return

  /* Clear the SVG currently assigned to this plotter — restores the tile to empty. */
  if (event.target.closest('[data-action="clear-assignment"]')) {
    event.preventDefault()
    event.stopPropagation()
    if (machine.status === 'plotting' || machine.status === 'previewing') {
      toastWarning('Cannot clear while the plotter is busy.')
      return
    }
    delete state.selectedFiles[machine.id]
    updateMachinePanelSvgPreview(machine.id)
    panel.querySelector('[data-role="preview-stats"]')?.remove()
    updateSidebarFooter()
    fileBrowser.syncHighlight()
    return
  }

  /* Dismiss error/complete — must sync server or next save replays stale status (e.g. complete banner). */
  if (event.target.closest('[data-action="dismiss-error"]') || event.target.closest('[data-action="dismiss-complete"]')) {
    try {
      const data = await callJson(`/api/machines/${encodeURIComponent(machine.id)}/dismiss-panel`, {
        method: 'POST'
      })
      if (data.machine) {
        upsertMachine(data.machine)
        updateSinglePanel(data.machine)
      }
    } catch (error) {
      toastError(error.message)
    }
    return
  }

  /* Utility commands */
  const commandButton = event.target.closest('[data-command]')
  if (commandButton) {
    const command = commandButton.dataset.command
    commandButton.dataset.loading = 'true'
    try {
      const result = await callJson(`/api/machines/${encodeURIComponent(machine.id)}/command`, {
        method: 'POST',
        body: JSON.stringify({ command })
      })
      toastSuccess(result.message || `${command} sent`)
    } catch (error) {
      toastError(error.message)
    } finally {
      commandButton.dataset.loading = 'false'
    }
    return
  }

  /* Preview / Plot */
  const actionButton = event.target.closest('[data-action]')
  if (!actionButton) return
  const action = actionButton.dataset.action

  if (action !== 'preview' && action !== 'plot') return

  const selectedFile = getSelectedFileForMachineOrWarn(machine.id)
  if (!selectedFile) return
  const options = collectPanelOptions(panel)

  try {
    if (action === 'preview') {
      actionButton.dataset.loading = 'true'
      await callJson('/api/plots/preview', {
        method: 'POST',
        body: JSON.stringify({ machineId: machine.id, filePath: selectedFile, options })
      })
      return
    }

    if (action === 'plot') {
      actionButton.dataset.loading = 'true'
      await callJson('/api/plots/start', {
        method: 'POST',
        body: JSON.stringify({ machineId: machine.id, filePath: selectedFile, options })
      })
      toastInfo('Plot started')
    }
  } catch (error) {
    toastError(error.message)
  } finally {
    actionButton.dataset.loading = 'false'
  }
})

/* ─── Rename form ─── */

document.addEventListener('submit', async (event) => {
  const renameForm = event.target.closest('[data-role="rename-form"]')
  if (!renameForm) return
  event.preventDefault()
  const panel = event.target.closest('.machine-panel')
  const machine = getPanelMachine(panel)
  if (!machine) return
  const formData = new FormData(renameForm)
  try {
    await callJson(`/api/machines/${encodeURIComponent(machine.id)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ name: formData.get('displayName') })
    })
    toastSuccess('Machine renamed')
  } catch (error) {
    toastError(error.message)
  }
})

/* ─── Header buttons ─── */

discoverButton.addEventListener('click', async () => {
  discoverButton.dataset.loading = 'true'
  try {
    const data = await callJson('/api/machines/discover', { method: 'POST' })
    state.machines = Array.isArray(data.machines) ? data.machines : []
    renderMachines()
    toastSuccess(`Found ${state.machines.length} machine(s)`)
  } catch (error) {
    toastError(error.message)
  } finally {
    discoverButton.dataset.loading = 'false'
  }
})

plotAllButton.addEventListener('click', async () => {
  const selectedFile =
    (state.activeMachineId && state.selectedFiles[state.activeMachineId]) ||
    state.machines.map((m) => state.selectedFiles[m.id]).find(Boolean)
  if (!selectedFile) {
    toastWarning('Select an SVG for at least one machine (use Assign to + library).')
    return
  }
  const options = state.machines[0]
    ? collectPanelOptions(document.querySelector('.machine-panel'))
    : {}
  plotAllButton.dataset.loading = 'true'
  try {
    await callJson('/api/plots/start-all', {
      method: 'POST',
      body: JSON.stringify({ filePath: selectedFile, options })
    })
    toastInfo('Plot started on all machines')
  } catch (error) {
    toastError(error.message)
  } finally {
    plotAllButton.dataset.loading = 'false'
  }
})

/* ─── Socket events ─── */

socket.on('machines:list', (machines) => {
  state.machines = Array.isArray(machines) ? machines : []
  syncMachineGrid()
})

socket.on('machine:status', (machine) => {
  upsertMachine(machine)
  updateSinglePanel(machine)
})

socket.on('preview:result', ({ machineId, preview }) => {
  const i = findMachineIndex(machineId)
  if (i === -1) return
  state.machines[i].preview = preview
  state.machines[i].status = 'ready'
  updateSinglePanel(state.machines[i])
  toastSuccess('Preview complete')
})

socket.on('plot:progress', ({ machineId, percent, remaining, endTime, preparing }) => {
  const panel = machineGrid.querySelector(`.machine-panel[data-machine-id="${window.CSS.escape(machineId)}"]`)
  if (!panel) return
  const machine = getPanelMachine(panel)
  panel.dataset.status = 'plotting'
  updateGlanceableProgress(panel, {
    percent,
    remaining,
    endTime,
    currentFile: machine?.currentFile,
    preparing
  })
})

socket.on('plot:complete', ({ machineId }) => {
  const i = findMachineIndex(machineId)
  if (i !== -1) {
    state.machines[i].status = 'complete'
    updateSinglePanel(state.machines[i])
  }
  toastSuccess('Plot finished!')
})

socket.on('plot:error', ({ machineId, error }) => {
  toastError(error || 'Plot error')
  if (machineId) {
    const i = findMachineIndex(machineId)
    if (i !== -1) {
      state.machines[i].status = 'error'
      state.machines[i].errorMessage = error
      updateSinglePanel(state.machines[i])
    }
  }
})

/* ─── Init ─── */

initThemeManager(document.getElementById('theme-select'))
initPartyCursor()

const fileBrowser = initFileBrowser({
  getHighlightPath: () =>
    state.activeMachineId ? state.selectedFiles[state.activeMachineId] : null,
  onFilePicked: (relativePath) => {
    if (!state.activeMachineId) {
      toastWarning('Click a machine panel first to choose where the file goes.')
      return
    }
    state.selectedFiles[state.activeMachineId] = relativePath
    updateMachinePanelSvgPreview(state.activeMachineId)
    updateSidebarFooter()
  },
  onFileDeleted: (relativePath) => {
    for (const id of Object.keys(state.selectedFiles)) {
      if (state.selectedFiles[id] === relativePath) delete state.selectedFiles[id]
    }
    state.machines.forEach((m) => updateMachinePanelSvgPreview(m.id))
    updateSidebarFooter()
  },
  onListUpdate (filesData) {
    state.files = filesData
  }
})

fileBrowser.refresh(state.files.currentDir || '').catch((error) => {
  toastError(error.message)
})

renderMachines()
