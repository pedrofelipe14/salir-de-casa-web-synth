// Display-side copy of the engine's custom waveform (dsp/include/sdc/custom_wave.h):
// same point rules and the same Catmull-Rom curve, so what you see is what plays.

export interface Point {
  x: number // position in the cycle, 0..1 (point 0 is pinned to 0)
  y: number // level, -1..1
}

export const NUM_POINTS = 8
const MIN_GAP = 0.02

export enum Wave { sine, saw, square, triangle, custom }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Evenly spaced points tracing a sine: the engine's starting shape. */
export function defaultPoints(): Point[] {
  return Array.from({ length: NUM_POINTS }, (_, i) => {
    const x = i / NUM_POINTS
    return { x, y: Math.sin(2 * Math.PI * x) }
  })
}

/** Returns a copy of points with one moved, kept between its neighbours. */
export function movePoint(points: Point[], index: number, p: Point): Point[] {
  const lowX = index === 0 ? 0 : points[index - 1].x + MIN_GAP
  const highX = index === NUM_POINTS - 1 ? 1 - MIN_GAP : points[index + 1].x - MIN_GAP
  const next = points.slice()
  next[index] = {
    x: index === 0 ? 0 : clamp(p.x, lowX, highX),
    y: clamp(p.y, -1, 1),
  }
  return next
}

/** Value of the curve through the points at phase (0..1). */
export function curveAt(points: Point[], phase: number): number {
  let segment = NUM_POINTS - 1
  for (let i = 0; i < NUM_POINTS - 1; i++) {
    if (phase < points[i + 1].x) {
      segment = i
      break
    }
  }
  const at = (i: number) => points[(i + NUM_POINTS) % NUM_POINTS]
  const startX = points[segment].x
  const endX = segment === NUM_POINTS - 1 ? 1 : points[segment + 1].x
  const t = (phase - startX) / Math.max(1e-6, endX - startX)
  const [y0, y1, y2, y3] = [at(segment - 1).y, at(segment).y, at(segment + 1).y, at(segment + 2).y]
  const value = 0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t * t
    + (-y0 + 3 * y1 - 3 * y2 + y3) * t * t * t)
  return clamp(value, -1, 1)
}

/** The textbook shape of a preset waveform at phase (0..1). */
export function presetShape(wave: Wave, phase: number): number {
  switch (wave) {
    case Wave.sine: return Math.sin(2 * Math.PI * phase)
    case Wave.saw: return 2 * phase - 1
    case Wave.square: return phase < 0.5 ? 1 : -1
    case Wave.triangle: return 4 * Math.abs(phase - 0.5) - 1
    case Wave.custom: return 0
  }
}

/** Value of whatever the oscillator is playing at phase. */
export function waveAt(wave: Wave, points: Point[], phase: number): number {
  return wave === Wave.custom ? curveAt(points, phase) : presetShape(wave, phase)
}
