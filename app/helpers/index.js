import { modelLabel as modelLabelFromOptions } from '../public/js/modelOptions.js'

function eq (left, right) {
  return left === right
}

function modelLabel (value) {
  return modelLabelFromOptions(value)
}

function json (value) {
  return JSON.stringify(value)
}

function ifEq (left, right, options) {
  if (left === right) return options.fn(this)
  const ln = Number(left)
  const rn = Number(right)
  if (Number.isFinite(ln) && Number.isFinite(rn) && ln === rn) return options.fn(this)
  return options.inverse(this)
}

function prettyDateTime (isoDate) {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (Number.isNaN(date.valueOf())) return ''
  return date.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function percent (value, decimals = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0'
  return numeric.toFixed(decimals)
}

function upper (value) {
  if (typeof value !== 'string') return ''
  return value.toUpperCase()
}

function fallback (value, whenFalsy = '') {
  return value || whenFalsy
}

export default {
  eq,
  ifEq,
  modelLabel,
  json,
  prettyDateTime,
  percent,
  upper,
  fallback
}
