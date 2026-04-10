import { MODEL_OPTIONS, modelLabel } from './modelOptions.js'

function escapeHtml (value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function selected (current, expected) {
  return Number(current) === Number(expected) ? 'selected' : ''
}

function checked (value) {
  return value ? 'checked' : ''
}

function safeOptions (machine) {
  return {
    speed: Number(machine?.options?.speed || 20),
    handling: Number(machine?.options?.handling || 1),
    reordering: Number(machine?.options?.reordering || 0),
    penlift: Number(machine?.options?.penlift || 1),
    model: Number(machine?.options?.model || machine.model || 8),
    webhook: String(machine?.options?.webhook || ''),
    randomStart: Boolean(machine?.options?.randomStart),
    hiding: Boolean(machine?.options?.hiding)
  }
}

function formatDuration (totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  if (safe < 60) return `${safe}s`
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function previewStatsBlock (machine) {
  if (!machine.preview) return ''
  const p = machine.preview
  return `
    <section class="preview-stats" data-role="preview-stats">
      <div class="stat-item">
        <span class="stat-label">Estimate</span>
        <span class="stat-value">${formatDuration(p.timeEstimate)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Pen-down</span>
        <span class="stat-value">${Number(p.distancePenDown || 0).toFixed(2)}m</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total dist</span>
        <span class="stat-value">${Number(p.distanceTotal || 0).toFixed(2)}m</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Pen lifts</span>
        <span class="stat-value">${Number(p.penLifts || 0)}</span>
      </div>
    </section>`
}

function machineSvgPreviewSection () {
  return `
    <section class="machine-svg-preview" data-role="machine-svg-preview">
      <div class="machine-svg-preview-inner hidden" data-role="svg-preview-inner">
        <div class="machine-svg-preview-paper">
          <img data-role="svg-preview-img" src="" alt="">
        </div>
        <p class="machine-svg-preview-caption" data-role="svg-preview-caption"></p>
      </div>
    </section>`
}

function commandRow (machine) {
  if (machine.isVirtual) return ''
  return `
    <div class="command-row">
      <button class="button button-ghost button-small" type="button" data-command="align">Align</button>
      <button class="button button-ghost button-small" type="button" data-command="sysinfo">Sysinfo</button>
      <button class="button button-ghost button-small" type="button" data-command="version">Version</button>
    </div>`
}

function renameRow (machine) {
  return `
    <form class="rename-form" data-role="rename-form">
      <input type="text" name="displayName" value="${escapeHtml(machine.displayName)}" required>
      <button class="button button-small" type="submit">Rename</button>
    </form>`
}

function renameSection (machine) {
  return `
    <section class="machine-rename" data-role="rename-section">
      ${renameRow(machine)}
    </section>`
}

function machineActionsSection (machine) {
  const commands = commandRow(machine)
  if (!commands) return ''
  return `
    <section class="machine-actions" data-role="machine-actions">
      ${commands}
    </section>`
}

function configSection (machine) {
  const o = safeOptions(machine)
  const isPreviewingOrPlotting = machine.status === 'previewing' || machine.status === 'plotting'
  const disabled = isPreviewingOrPlotting ? 'disabled' : ''

  return `
    <section class="plot-config" data-role="plot-config">
      <div class="field-grid">
        <label><span>Speed</span><input type="number" min="1" max="100" name="speed" value="${o.speed}" ${disabled}></label>
        <label>
          <span>Handling</span>
          <select name="handling" ${disabled}>
            <option value="1" ${selected(o.handling, 1)}>Technical</option>
            <option value="2" ${selected(o.handling, 2)}>Handwriting</option>
            <option value="3" ${selected(o.handling, 3)}>Sketching</option>
            <option value="4" ${selected(o.handling, 4)}>Constant</option>
          </select>
        </label>
        <label>
          <span>Reordering</span>
          <select name="reordering" ${disabled}>
            <option value="0" ${selected(o.reordering, 0)}>Least</option>
            <option value="1" ${selected(o.reordering, 1)}>Basic</option>
            <option value="2" ${selected(o.reordering, 2)}>Full</option>
            <option value="4" ${selected(o.reordering, 4)}>None</option>
          </select>
        </label>
        <label>
          <span>Penlift</span>
          <select name="penlift" ${disabled}>
            <option value="1" ${selected(o.penlift, 1)}>Default</option>
            <option value="2" ${selected(o.penlift, 2)}>Reserved</option>
            <option value="3" ${selected(o.penlift, 3)}>Brushless</option>
          </select>
        </label>
        <label>
          <span>Model</span>
          <select name="model" ${disabled}>
            ${MODEL_OPTIONS.map(({ value, label }) =>
              `<option value="${value}" ${selected(o.model, value)}>${escapeHtml(label)}</option>`
            ).join('')}
          </select>
        </label>
        <div class="plot-config-command-cell" role="group" aria-label="Quick machine commands">
          <span class="plot-config-field-heading">Pen</span>
          <div class="plot-config-command-buttons">
            <button class="button button-small" type="button" data-command="toggle" ${disabled}>Toggle</button>
            <button class="button button-small" type="button" data-command="walk_home" ${disabled}>Walk home</button>
          </div>
        </div>
        <label class="full-width"><span>Webhook URL</span><input type="text" name="webhook" value="${escapeHtml(o.webhook)}" ${disabled}></label>
        <label class="checkbox-row"><input type="checkbox" name="randomStart" ${checked(o.randomStart)} ${disabled}><span>Random start</span></label>
        <label class="checkbox-row"><input type="checkbox" name="hiding" ${checked(o.hiding)} ${disabled}><span>Hidden-line removal</span></label>
      </div>
    </section>`
}

function plotControlsSection (machine) {
  const isPreviewing = machine.status === 'previewing'
  const isPlotting = machine.status === 'plotting'
  const hasPreview = Boolean(machine.preview)

  return `
    <section class="plot-controls" data-role="plot-controls">
      <button class="button button-primary" type="button" data-action="preview"
        ${isPreviewing ? 'data-loading="true"' : ''}
        ${isPlotting ? 'disabled' : ''}>
        ${isPreviewing ? 'Previewing…' : 'Preview'}
      </button>
      <button class="button button-accent" type="button" data-action="plot"
        ${isPlotting || isPreviewing ? 'disabled' : ''}
        ${!hasPreview ? 'title="Run a preview first"' : ''}>
        Plot
      </button>
    </section>`
}

function glanceableSection (machine) {
  return `
    <section class="glanceable-progress" data-role="glanceable-progress">
      <div class="plot-progress-shell">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="progress-ring-bg" cx="60" cy="60" r="52"></circle>
          <circle class="progress-ring-fg" cx="60" cy="60" r="52"></circle>
        </svg>
        <div class="progress-center">
          <div class="progress-percent">0%</div>
          <div class="progress-caption">progress</div>
        </div>
      </div>
      <div class="countdown-block">
        <div class="countdown-time">??:??:??</div>
        <div class="countdown-label">remaining</div>
      </div>
      <div class="glanceable-meta">
        <div data-role="done-at">Done at --:--</div>
        <div data-role="active-file">${escapeHtml(machine.currentFile || '')}</div>
      </div>
    </section>`
}

function errorBlock (machine) {
  if (machine.status !== 'error' || !machine.errorMessage) return ''
  return `
    <div class="message-block message-error" data-role="error-block">
      <span>${escapeHtml(machine.errorMessage)}</span>
      <button class="button button-small button-ghost" type="button" data-action="dismiss-error">Dismiss</button>
    </div>`
}

function completeBlock (machine) {
  if (machine.status !== 'complete') return ''
  return `
    <div class="message-block message-success" data-role="complete-block">
      <span>Plot complete</span>
      <button class="button button-small button-ghost" type="button" data-action="dismiss-complete">Dismiss</button>
    </div>`
}

export function machinePanelTemplate (machine) {
  return `
    <article class="machine-panel" title="Click background to select this machine for SVG assignment" data-machine-id="${escapeHtml(machine.id)}" data-status="${escapeHtml(machine.status)}">
      <header class="machine-panel-header">
        <div>
          <h3>${escapeHtml(machine.displayName)}</h3>
          <p class="machine-meta">${escapeHtml(machine.port)}</p>
        </div>
        <div class="machine-badges">
          <span class="badge badge-status" data-status="${escapeHtml(machine.status)}">${escapeHtml(machine.status)}</span>
          <span class="badge badge-model">${machine.isVirtual ? 'virtual' : escapeHtml(modelLabel(safeOptions(machine).model))}</span>
        </div>
      </header>

      ${renameSection(machine)}
      ${machineSvgPreviewSection()}
      ${machineActionsSection(machine)}

      <hr class="section-divider">

      ${configSection(machine)}
      ${previewStatsBlock(machine)}
      ${plotControlsSection(machine)}
      ${glanceableSection(machine)}
      ${errorBlock(machine)}
      ${completeBlock(machine)}
    </article>
  `
}

function syncPlotConfigInteractivity (panelElement, status) {
  const config = panelElement.querySelector('[data-role="plot-config"]')
  if (!config) return
  const locked = status === 'previewing' || status === 'plotting'
  for (const el of config.querySelectorAll('input, select, textarea')) {
    el.disabled = locked
  }
  for (const btn of config.querySelectorAll('.plot-config-command-buttons [data-command]')) {
    btn.disabled = locked
  }
}

export function collectPanelOptions (panelElement) {
  const get = (selector) => panelElement.querySelector(selector)

  return {
    speed: Number(get('input[name="speed"]')?.value || 20),
    handling: Number(get('select[name="handling"]')?.value || 1),
    reordering: Number(get('select[name="reordering"]')?.value || 0),
    penlift: Number(get('select[name="penlift"]')?.value || 1),
    model: Number(get('select[name="model"]')?.value || 8),
    webhook: String(get('input[name="webhook"]')?.value || '').trim(),
    randomStart: Boolean(get('input[name="randomStart"]')?.checked),
    hiding: Boolean(get('input[name="hiding"]')?.checked)
  }
}

/**
 * Patch an existing panel DOM node in place, preserving form state
 * where possible. Returns true if a full re-render was needed.
 */
export function patchPanel (panelElement, machine) {
  const currentStatus = panelElement.dataset.status
  const newStatus = machine.status

  panelElement.dataset.status = newStatus

  const header = panelElement.querySelector('.machine-panel-header h3')
  if (header && header.textContent !== machine.displayName) {
    header.textContent = machine.displayName
  }

  const meta = panelElement.querySelector('.machine-meta')
  if (meta && meta.textContent !== machine.port) {
    meta.textContent = machine.port
  }

  const statusBadge = panelElement.querySelector('.badge-status')
  if (statusBadge) {
    statusBadge.dataset.status = newStatus
    statusBadge.textContent = newStatus
  }

  const modelBadge = panelElement.querySelector('.badge-model')
  if (modelBadge) {
    modelBadge.textContent = machine.isVirtual ? 'virtual' : modelLabel(safeOptions(machine).model)
  }

  const previewBtn = panelElement.querySelector('[data-action="preview"]')
  if (previewBtn) {
    previewBtn.dataset.loading = String(newStatus === 'previewing')
    previewBtn.textContent = newStatus === 'previewing' ? 'Previewing…' : 'Preview'
    previewBtn.disabled = newStatus === 'plotting'
  }

  const plotBtn = panelElement.querySelector('[data-action="plot"]')
  if (plotBtn) {
    plotBtn.disabled = newStatus === 'plotting' || newStatus === 'previewing'
  }

  if (machine.preview && currentStatus !== newStatus) {
    const existing = panelElement.querySelector('[data-role="preview-stats"]')
    const html = previewStatsBlock(machine)
    if (html && !existing) {
      const controls = panelElement.querySelector('[data-role="plot-controls"]')
      if (controls) controls.insertAdjacentHTML('beforebegin', html)
    } else if (html && existing) {
      existing.outerHTML = html
    }
  }

  const activeFile = panelElement.querySelector('[data-role="active-file"]')
  if (activeFile && machine.currentFile) {
    activeFile.textContent = machine.currentFile
  }

  const errBlock = panelElement.querySelector('[data-role="error-block"]')
  if (newStatus === 'error' && !errBlock && machine.errorMessage) {
    panelElement.insertAdjacentHTML('beforeend', errorBlock(machine))
  } else if (newStatus !== 'error' && errBlock) {
    errBlock.remove()
  }

  const compBlock = panelElement.querySelector('[data-role="complete-block"]')
  if (newStatus === 'complete' && !compBlock) {
    panelElement.insertAdjacentHTML('beforeend', completeBlock(machine))
  } else if (newStatus !== 'complete' && compBlock) {
    compBlock.remove()
  }

  syncPlotConfigInteractivity(panelElement, newStatus)

  return false
}
