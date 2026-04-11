/**
 * NextDraw / AxiDraw model codes (--model). Labels from nextdraw CLI help.
 */
export const MODEL_OPTIONS = [
  { value: 1, label: 'AxiDraw V2 or V3' },
  { value: 2, label: 'AxiDraw V3/A3 or SE/A3' },
  { value: 3, label: 'AxiDraw V3 XLX' },
  { value: 4, label: 'AxiDraw MiniKit' },
  { value: 5, label: 'AxiDraw SE/A1' },
  { value: 6, label: 'AxiDraw SE/A2' },
  { value: 7, label: 'AxiDraw V3/B6' },
  { value: 8, label: 'Bantam Tools NextDraw 8511' },
  { value: 9, label: 'Bantam Tools NextDraw 1117' },
  { value: 10, label: 'Bantam Tools NextDraw 2234' }
]

export function modelLabel (code) {
  const n = Number(code)
  const found = MODEL_OPTIONS.find((o) => o.value === n)
  return found ? found.label : `Model ${n}`
}
