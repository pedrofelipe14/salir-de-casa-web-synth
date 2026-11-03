import { useEffect, useRef } from 'react'
import { formatValue, fromNormalized, toNormalized, type ParamSpec } from '../engine/params'

interface Props {
  spec: ParamSpec
  value: number
  onChange: (value: number) => void
}

const START = (-135 * Math.PI) / 180 // 7:30 on a clock face
const END = (135 * Math.PI) / 180 // 4:30
const SIZE = 58
const R = 22

const polar = (angle: number, radius: number) => ({
  x: SIZE / 2 + radius * Math.sin(angle),
  y: SIZE / 2 - radius * Math.cos(angle),
})

function arc(from: number, to: number, radius: number): string {
  const a = polar(from, radius)
  const b = polar(to, radius)
  const large = Math.abs(to - from) > Math.PI ? 1 : 0
  const sweep = to > from ? 1 : 0
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${large} ${sweep} ${b.x} ${b.y}`
}

/** Drag up/down (Shift for fine), scroll, arrow keys; double-click resets. */
export function Knob({ spec, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; n: number } | null>(null)
  const norm = toNormalized(spec, value)

  const setNormalized = (n: number) => onChange(fromNormalized(spec, n))
  const step = spec.integer ? 1 / (spec.max - spec.min) : 0.01

  // Wheel needs a non-passive listener to stop the page from scrolling.
  const latest = useRef({ norm, step, setNormalized })
  latest.current = { norm, step, setNormalized }
  useEffect(() => {
    const el = ref.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { norm, step, setNormalized } = latest.current
      setNormalized(norm + (e.deltaY < 0 ? step : -step))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Bipolar ranges (fine tune, octave...) light the ring from the centre.
  const bipolar = spec.min < 0 && spec.max > 0
  const zero = bipolar ? toNormalized(spec, 0) : 0
  const angle = START + norm * (END - START)
  const from = START + zero * (END - START)
  const tip = polar(angle, R - 6)

  return (
    <div className="control">
      <span className="control-label">{spec.label}</span>
      <div
        ref={ref}
        className="knob"
        role="slider"
        tabIndex={0}
        aria-label={spec.label}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
        aria-valuetext={formatValue(spec, value)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { y: e.clientY, n: norm }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const range = e.shiftKey ? 900 : 220 // pixels for the full sweep
          setNormalized(drag.current.n + (drag.current.y - e.clientY) / range)
        }}
        onPointerUp={() => (drag.current = null)}
        onDoubleClick={() => onChange(spec.defaultValue)}
        onKeyDown={(e) => {
          const keys: Record<string, number> = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step }
          if (e.key in keys) {
            e.preventDefault()
            setNormalized(norm + keys[e.key] * (e.shiftKey ? 10 : 1))
          } else if (e.key === 'Home') setNormalized(0)
          else if (e.key === 'End') setNormalized(1)
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <path d={arc(START, END, R + 4)} className="knob-track" />
          {Math.abs(angle - from) > 0.01 && (
            <path d={arc(Math.min(from, angle), Math.max(from, angle), R + 4)} className="knob-value" />
          )}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R - 1} className="knob-body" />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R - 5} className="knob-face" />
          <line x1={SIZE / 2} y1={SIZE / 2} x2={tip.x} y2={tip.y} className="knob-pointer" />
        </svg>
      </div>
      <span className="control-value">{formatValue(spec, value)}</span>
    </div>
  )
}
