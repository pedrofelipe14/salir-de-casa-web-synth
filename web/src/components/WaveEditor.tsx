import { useRef, useState } from 'react'
import { movePoint, presetShape, Wave, waveAt, type Point } from '../engine/wave'

interface Props {
  title: string
  wave: Wave
  points: Point[]
  /** Called with the full new set of points and which one moved. */
  onPointsChange: (points: Point[], moved: number[]) => void
  onWaveChange: (wave: Wave) => void
}

const W = 520
const H = 150
const PAD = 10
const GRAB = 12

const toScreen = (p: Point) => ({ x: PAD + p.x * (W - 2 * PAD), y: H / 2 - p.y * (H / 2 - PAD) })

/** The oscillator's cycle, with points you drag to reshape it. Grabbing a point while a
    preset shape is playing starts from that shape and switches the oscillator to "Propia". */
export function WaveEditor({ title, wave, points, onPointsChange, onWaveChange }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const custom = wave === Wave.custom

  // On a preset shape, the points sit on that shape until you grab one.
  const shown = custom ? points : points.map((p) => ({ x: p.x, y: presetShape(wave, p.x) }))

  const path = Array.from({ length: 161 }, (_, i) => {
    const phase = i / 160
    const { x, y } = toScreen({ x: phase, y: waveAt(wave, points, Math.min(phase, 0.9999)) })
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const toLocal = (e: React.PointerEvent): Point => {
    const r = svg.current!.getBoundingClientRect()
    const sx = ((e.clientX - r.left) / r.width) * W
    const sy = ((e.clientY - r.top) / r.height) * H
    return { x: (sx - PAD) / (W - 2 * PAD), y: (H / 2 - sy) / (H / 2 - PAD) }
  }

  const nearest = (e: React.PointerEvent): number | null => {
    const r = svg.current!.getBoundingClientRect()
    const sx = ((e.clientX - r.left) / r.width) * W
    const sy = ((e.clientY - r.top) / r.height) * H
    let best: number | null = null
    let bestDist = GRAB
    shown.forEach((p, i) => {
      const s = toScreen(p)
      const d = Math.hypot(s.x - sx, s.y - sy)
      if (d < bestDist) {
        best = i
        bestDist = d
      }
    })
    return best
  }

  return (
    <div className="wave-editor">
      <div className="wave-head">
        <span>{title}</span>
        <span className="wave-hint">{custom ? 'onda propia' : 'arrastrá un punto para editar'}</span>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className={hover !== null || dragging !== null ? 'grab' : ''}
        role="img"
        aria-label={`${title}: forma de onda`}
        onPointerDown={(e) => {
          const index = nearest(e)
          if (index === null) return
          e.currentTarget.setPointerCapture(e.pointerId)
          if (!custom) {
            // Start from the shape that's playing, so nothing jumps.
            onPointsChange(shown, shown.map((_, i) => i))
            onWaveChange(Wave.custom)
          }
          setDragging(index)
        }}
        onPointerMove={(e) => {
          if (dragging === null) {
            setHover(nearest(e))
            return
          }
          onPointsChange(movePoint(points, dragging, toLocal(e)), [dragging])
        }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} className="wave-axis" />
        <path d={path} className="wave-line" />
        {shown.map((p, i) => {
          const s = toScreen(p)
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={i === dragging || i === hover ? 6 : 4.5}
              className={custom ? 'wave-point' : 'wave-point ghost'}
            />
          )
        })}
      </svg>
    </div>
  )
}
