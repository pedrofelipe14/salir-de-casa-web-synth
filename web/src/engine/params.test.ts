import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatValue, fromNormalized, PARAM_COUNT, ParamId, PARAMS, toNormalized } from './params'

// The UI and the C++ engine each keep a parameter table; this keeps them honest.
describe('parameter table', () => {
  const header = readFileSync(new URL('../../../dsp/include/sdc/params.h', import.meta.url), 'utf8')

  it('lists the same parameters, in the same order, as the C++ engine', () => {
    const body = header.match(/enum class Param : int\s*\{([^}]*)\}/)![1]
    const names = body.split(',').map((s) => s.trim()).filter((s) => s && s !== 'count')
    expect(names).toEqual(PARAMS.map((p) => ParamId[p.id]))
    expect(PARAMS.map((p) => p.id)).toEqual([...Array(PARAM_COUNT).keys()])
  })

  it('uses the same ranges and defaults as the C++ engine', () => {
    const table = header.match(/paramInfo\[[^\]]*\] = \{([\s\S]*?)\n\};/)![1]
    const triples = [...table.matchAll(/\{\s*([-\d.]+)f?,\s*([-\d.]+)f?,\s*([-\d.]+)f?\s*\}/g)]
      .map((m) => m.slice(1, 4).map(Number))
    expect(triples).toEqual(PARAMS.map((p) => [p.min, p.max, p.defaultValue]))
  })
})

describe('knob mapping', () => {
  it('round-trips every parameter through the knob position', () => {
    for (const p of PARAMS) {
      for (const n of [0, 0.25, 0.5, 0.9, 1]) {
        const value = fromNormalized(p, n)
        expect(value).toBeGreaterThanOrEqual(p.min)
        expect(value).toBeLessThanOrEqual(p.max)
        if (!p.integer) expect(toNormalized(p, value)).toBeCloseTo(n, 6)
      }
    }
  })

  it('gives low frequencies more of the knob on skewed ranges', () => {
    const cutoff = PARAMS[ParamId.cutoff]
    expect(fromNormalized(cutoff, 0.5)).toBeLessThan(2500) // linear would be ~10 kHz
  })

  it('snaps stepped parameters to whole values', () => {
    expect(Number.isInteger(fromNormalized(PARAMS[ParamId.osc1Octave], 0.61))).toBe(true)
  })
})

describe('value labels', () => {
  it.each([
    [ParamId.cutoff, 4500, '4.50 kHz'],
    [ParamId.cutoff, 440, '440 Hz'],
    [ParamId.attack, 0.3, '300 ms'],
    [ParamId.release, 1.5, '1.50 s'],
    [ParamId.osc2Fine, 7, '+7.0 ct'],
    [ParamId.osc1Octave, -1, '-1 oct'],
    [ParamId.sustain, 0.8, '80 %'],
    [ParamId.volume, -6, '-6.0 dB'],
    [ParamId.lfoRate, 0.35, '0.35 Hz'],
    [ParamId.lfoTarget, 1, 'Tono'],
    [ParamId.glitchGrainSize, 250, '250 ms'],
    [ParamId.loopInterval, 6, '+5ta'],
    [ParamId.wetMode, 2, 'Slip'],
    [ParamId.autoGlitch, 1, 'Sí'],
  ])('param %s = %s reads "%s"', (id, value, text) => {
    expect(formatValue(PARAMS[id], value)).toBe(text)
  })
})
