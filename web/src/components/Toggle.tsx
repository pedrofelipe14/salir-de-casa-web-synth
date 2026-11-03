import type { ParamSpec } from '../engine/params'

interface Props {
  spec: ParamSpec
  value: number
  onChange: (value: number) => void
}

/** A pill switch for on/off parameters (Auto-Glitch, Mantener). */
export function Toggle({ spec, value, onChange }: Props) {
  const on = value > 0.5
  return (
    <div className="control">
      <span className="control-label">{spec.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={spec.label}
        className={`toggle ${on ? 'on' : ''}`}
        onClick={() => onChange(on ? 0 : 1)}
      >
        <span className="toggle-thumb" />
      </button>
      <span className="control-value">{on ? 'Sí' : 'No'}</span>
    </div>
  )
}
