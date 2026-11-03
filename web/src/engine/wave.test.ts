import { describe, expect, it } from 'vitest'
import { curveAt, defaultPoints, movePoint, NUM_POINTS, presetShape, Wave, waveAt } from './wave'

describe('custom wave', () => {
  it('starts as a sine, like the engine', () => {
    const pts = defaultPoints()
    expect(pts).toHaveLength(NUM_POINTS)
    expect(curveAt(pts, 0.25)).toBeCloseTo(1, 1)
    expect(curveAt(pts, 0.75)).toBeCloseTo(-1, 1)
  })

  it('keeps points in order and in range', () => {
    const pts = movePoint(defaultPoints(), 3, { x: 0.95, y: 3 })
    expect(pts[3].x).toBeLessThan(pts[4].x)
    expect(pts[3].y).toBe(1)
    expect(movePoint(pts, 0, { x: 0.4, y: 0 })[0].x).toBe(0) // first point is pinned
  })

  it('does not mutate the points it was given', () => {
    const pts = defaultPoints()
    movePoint(pts, 2, { x: 0.3, y: 0 })
    expect(pts).toEqual(defaultPoints())
  })

  it('draws preset shapes until switched to custom', () => {
    const pts = defaultPoints()
    expect(waveAt(Wave.saw, pts, 0.75)).toBe(presetShape(Wave.saw, 0.75))
    expect(waveAt(Wave.custom, pts, 0.25)).toBeCloseTo(1, 1)
  })
})
