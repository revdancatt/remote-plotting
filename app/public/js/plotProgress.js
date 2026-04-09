const CIRCLE_LENGTH = 2 * Math.PI * 52

function zeroPad (value) {
  return String(value).padStart(2, '0')
}

export function formatDuration (totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${zeroPad(hours)}:${zeroPad(minutes)}:${zeroPad(seconds)}`
}

export function updateGlanceableProgress (panelElement, { percent, remaining, endTime, currentFile, preparing }) {
  const shell = panelElement.querySelector('[data-role="glanceable-progress"]')
  if (!shell) return

  const ring = shell.querySelector('.progress-ring-fg')
  const percentLabel = shell.querySelector('.progress-percent')
  const countdown = shell.querySelector('.countdown-time')
  const doneAt = shell.querySelector('[data-role="done-at"]')
  const activeFile = shell.querySelector('[data-role="active-file"]')

  const clampedPercent = preparing
    ? 0
    : Math.max(0, Math.min(100, Number(percent || 0)))
  const dashOffset = CIRCLE_LENGTH - (CIRCLE_LENGTH * clampedPercent / 100)
  ring.style.strokeDashoffset = String(dashOffset)

  percentLabel.textContent = `${Math.round(clampedPercent)}%`
  countdown.textContent =
    remaining == null ? '??:??:??' : formatDuration(remaining)

  if (endTime) {
    const endDate = new Date(endTime)
    doneAt.textContent = Number.isNaN(endDate.valueOf())
      ? 'Done at --:--'
      : `Done at ~${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } else {
    doneAt.textContent = 'Done at --:--'
  }
  if (currentFile) activeFile.textContent = currentFile
}

export function hideGlanceableProgress (panelElement) {
  const shell = panelElement.querySelector('[data-role="glanceable-progress"]')
  if (shell) shell.classList.add('hidden')
}
