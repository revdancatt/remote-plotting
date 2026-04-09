/* global requestAnimationFrame, cancelAnimationFrame, MutationObserver */
/**
 * Party theme only: tiny cursor particles that drift, fall with gravity, and fade out.
 * Respects prefers-reduced-motion.
 */

const GRAVITY = 0.14
const MAX_PARTICLES = 260
const SPAWN_INTERVAL_MS = 10

let layer = null
let particles = []
let rafId = 0
let running = false
let lastSpawn = 0
let onMoveRef = null

function isPartyTheme () {
  return document.documentElement.dataset.theme === 'party'
}

function prefersReducedMotion () {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function randomPartyColor () {
  if (Math.random() < 0.52) {
    return `hsl(${318 + Math.random() * 28}, 92%, ${58 + Math.random() * 14}%)`
  }
  return `hsl(${168 + Math.random() * 32}, 92%, ${58 + Math.random() * 14}%)`
}

function ensureLayer () {
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'party-cursor-particles'
    layer.setAttribute('aria-hidden', 'true')
    layer.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:9990;overflow:hidden;contain:strict'
    document.body.appendChild(layer)
  }
  return layer
}

function removeLayer () {
  if (layer) {
    layer.remove()
    layer = null
  }
}

function spawnParticle (clientX, clientY) {
  if (particles.length >= MAX_PARTICLES) {
    const old = particles.shift()
    old.el.remove()
  }

  const size = 2 + Math.random() * 2.2
  const el = document.createElement('div')
  const left = clientX - size / 2
  const top = clientY - size / 2
  const glow = 1.5 + Math.random() * 3.5
  el.style.cssText = [
    'position:absolute',
    `left:${left}px`,
    `top:${top}px`,
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50%',
    `background:${randomPartyColor()}`,
    `box-shadow:0 0 ${glow}px rgba(255,255,255,0.35),0 0 ${glow * 1.5}px rgba(255,72,216,0.15)`,
    'pointer-events:none',
    'will-change:left,top,opacity'
  ].join(';')

  ensureLayer().appendChild(el)

  particles.push({
    el,
    x: left,
    y: top,
    vx: (Math.random() - 0.5) * 2.8,
    vy: (Math.random() - 0.5) * 1.8 - 0.8,
    life: 1,
    decay: 0.004 + Math.random() * 0.004
  })
}

function tick () {
  if (!running) {
    rafId = 0
    return
  }

  const h = window.innerHeight
  const w = window.innerWidth
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.vy += GRAVITY
    p.vx *= 0.997
    p.x += p.vx
    p.y += p.vy
    p.life -= p.decay

    const op = Math.max(0, p.life)
    p.el.style.opacity = String(op)
    p.el.style.left = `${p.x}px`
    p.el.style.top = `${p.y}px`

    if (p.life <= 0 || p.y > h + 24 || p.x < -20 || p.x > w + 20) {
      p.el.remove()
      particles.splice(i, 1)
    }
  }

  if (particles.length > 0) {
    rafId = requestAnimationFrame(tick)
  } else {
    rafId = 0
  }
}

function onMove (e) {
  if (!isPartyTheme() || prefersReducedMotion()) return
  const now = performance.now()
  if (now - lastSpawn < SPAWN_INTERVAL_MS) return
  lastSpawn = now
  spawnParticle(e.clientX, e.clientY)
  if (!rafId && running) rafId = requestAnimationFrame(tick)
}

function teardown () {
  running = false
  if (onMoveRef) {
    window.removeEventListener('mousemove', onMoveRef, true)
    onMoveRef = null
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  particles.forEach((p) => p.el.remove())
  particles = []
  removeLayer()
  lastSpawn = 0
}

function setup () {
  if (prefersReducedMotion()) return
  if (!isPartyTheme()) return

  running = true
  onMoveRef = onMove
  window.addEventListener('mousemove', onMoveRef, true)
}

function onThemeChange () {
  teardown()
  if (isPartyTheme() && !prefersReducedMotion()) {
    setup()
  }
}

export function initPartyCursor () {
  const observer = new MutationObserver(() => onThemeChange())
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', onThemeChange)

  onThemeChange()
}
