import { formatValue, labelOf, type Lang, type ParamSpec } from '../engine/params'

interface Props {
  spec: ParamSpec
  value: number
  onChange: (value: number) => void
  lang: Lang
}

/** A pill switch for on/off parameters (Auto-Glitch, Mantener). */
export function Toggle({ spec, value, onChange, lang }: Props) {
  const label = labelOf(spec, lang)
  const on = value > 0.5
  return (
    <div className="control">
      <span className="control-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`toggle ${on ? 'on' : ''}`}
        onClick={() => onChange(on ? 0 : 1)}
      >
        <span className="toggle-thumb" />
      </button>
      <span className="control-value">{formatValue(spec, value, lang)}</span>
    </div>
  )
}
