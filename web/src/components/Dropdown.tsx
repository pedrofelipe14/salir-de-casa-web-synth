import type { ParamSpec } from '../engine/params'

interface Props {
  spec: ParamSpec
  value: number
  onChange: (value: number) => void
}

/** A drop-down for stepped parameters with too many options for buttons (loop interval). */
export function Dropdown({ spec, value, onChange }: Props) {
  return (
    <label className="control">
      <span className="control-label">{spec.label}</span>
      <select className="dropdown" value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))}>
        {spec.choices!.map((label, i) => <option key={label} value={i}>{label}</option>)}
      </select>
    </label>
  )
}
