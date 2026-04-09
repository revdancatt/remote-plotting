const THEME_KEY = 'mvpt-theme-mode'

/** All options shown in the theme dropdown (order = display order) */
export const THEME_CHOICES = [
  { id: 'auto', label: 'Auto (system)' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'party', label: 'Party' },
  { id: 'nature', label: 'Nature' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunrise', label: 'Sunrise' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'paper', label: 'Paper' },
  { id: 'studio', label: 'Studio' },
  { id: 'retro-terminal', label: 'Retro terminal' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'monochrome', label: 'Monochrome' },
  { id: 'high-contrast', label: 'High contrast' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'arctic', label: 'Arctic' },
  { id: 'desert', label: 'Desert' },
  { id: 'botanical', label: 'Botanical' },
  { id: 'ink-wash', label: 'Ink wash' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'cozy', label: 'Cozy' },
  { id: 'neon-noir', label: 'Neon noir' },
  { id: 'pastel', label: 'Pastel' },
  { id: 'blueprint', label: 'Blueprint' }
]

const ALLOWED_IDS = new Set(THEME_CHOICES.map((c) => c.id))

function resolveDocumentTheme (mode) {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function populateSelect (selectElement) {
  selectElement.innerHTML = ''
  for (const { id, label } of THEME_CHOICES) {
    const opt = document.createElement('option')
    opt.value = id
    opt.textContent = label
    selectElement.appendChild(opt)
  }
}

export function initThemeManager (selectElement) {
  if (!selectElement) return { getMode: () => 'auto', setMode: () => {} }

  populateSelect(selectElement)

  let mode = window.localStorage.getItem(THEME_KEY) || 'auto'
  if (!ALLOWED_IDS.has(mode)) mode = 'auto'

  function apply () {
    const applied = resolveDocumentTheme(mode)
    document.documentElement.dataset.theme = applied
    selectElement.value = mode
  }

  function setMode (nextMode) {
    const next = ALLOWED_IDS.has(nextMode) ? nextMode : 'auto'
    mode = next
    window.localStorage.setItem(THEME_KEY, mode)
    apply()
  }

  selectElement.addEventListener('change', () => {
    setMode(selectElement.value)
  })

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    if (mode === 'auto') apply()
  })

  apply()

  return {
    getMode: () => mode,
    setMode
  }
}
