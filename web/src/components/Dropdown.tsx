import { choicesOf, labelOf, type Lang, type ParamSpec } from '../engine/params'

interface Props {
  spec: ParamSpec
  value: number
  onChange: (value: number) => void
  lang: Lang
}

/** A drop-down for stepped parameters with too many options for buttons (loop interval). */
export function Dropdown({ spec, value, onChange, lang }: Props) {
  return (
    <label className="control">
      <span className="control-label">{labelOf(spec, lang)}</span>
      {/* Blur after choosing so the computer keyboard goes back to playing notes. */}
      <select className="dropdown" value={Math.round(value)} onChange={(e) => { onChange(Number(e.target.value)); e.target.blur() }}>
        {choicesOf(spec, lang).map((text, i) => <option key={i} value={i}>{text}</option>)}
      </select>
    </label>
  )
}
