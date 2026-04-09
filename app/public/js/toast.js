const ICONS = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕'
}

const DEFAULT_DURATION = 4000
const MAX_TOASTS = 5

let container = null

function ensureContainer () {
  if (container) return container
  container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.className = 'toast-container'
    container.setAttribute('aria-live', 'polite')
    container.setAttribute('aria-relevant', 'additions')
    document.body.appendChild(container)
  }
  return container
}

function dismiss (el) {
  el.classList.add('toast-leaving')
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

export function toast (message, type = 'info', duration = DEFAULT_DURATION) {
  const wrap = ensureContainer()

  while (wrap.children.length >= MAX_TOASTS) {
    dismiss(wrap.firstElementChild)
  }

  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.setAttribute('role', 'status')
  el.style.setProperty('--toast-duration', `${duration}ms`)

  el.innerHTML = [
    `<span class="toast-icon">${ICONS[type] || ICONS.info}</span>`,
    `<div class="toast-body"><span class="toast-message">${escapeHtml(message)}</span></div>`,
    '<button class="toast-dismiss" aria-label="Dismiss">&times;</button>',
    '<div class="toast-progress"></div>'
  ].join('')

  el.querySelector('.toast-dismiss').addEventListener('click', () => dismiss(el))

  wrap.appendChild(el)

  if (duration > 0) {
    setTimeout(() => {
      if (el.parentNode) dismiss(el)
    }, duration)
  }

  return el
}

export const toastInfo = (msg, dur) => toast(msg, 'info', dur)
export const toastSuccess = (msg, dur) => toast(msg, 'success', dur)
export const toastWarning = (msg, dur) => toast(msg, 'warning', dur)
export const toastError = (msg, dur) => toast(msg, 'error', dur)

function escapeHtml (str) {
  const el = document.createElement('span')
  el.textContent = str
  return el.innerHTML
}
