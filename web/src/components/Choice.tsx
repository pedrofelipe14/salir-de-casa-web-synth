import type { ParamSpec } from '../engine/params'

interface Props {
  spec: ParamSpec
  value: number
  onChange: (value: number) => void
}

/** A row of buttons for a stepped parameter (waveform, LFO shape...). */
export function Choice({ spec, value, onChange }: Props) {
  return (
    <div className="control choice">
      <span className="control-label">{spec.label}</span>
      <div className="choice-buttons" role="radiogroup" aria-label={spec.label}>
        {spec.choices!.map((label, i) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={Math.round(value) === i}
            className={Math.round(value) === i ? 'on' : ''}
            onClick={() => onChange(i)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
