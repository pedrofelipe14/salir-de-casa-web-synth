import { choicesOf, labelOf, type Lang, type ParamSpec } from '../engine/params'

interface Props {
  spec: ParamSpec
  value: number
  onChange: (value: number) => void
  lang: Lang
}

/** A row of buttons for a stepped parameter (waveform, LFO shape...). */
export function Choice({ spec, value, onChange, lang }: Props) {
  const label = labelOf(spec, lang)
  return (
    <div className="control choice">
      <span className="control-label">{label}</span>
      <div className="choice-buttons" role="radiogroup" aria-label={label}>
        {choicesOf(spec, lang).map((text, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={Math.round(value) === i}
            className={Math.round(value) === i ? 'on' : ''}
            onClick={() => onChange(i)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
